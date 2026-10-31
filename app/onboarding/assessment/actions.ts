"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TopicSelfAssessment = "know" | "unknown" | "unsure";

export type TopicSelectionInput = {
  topicId: string;
  selfAssessment: TopicSelfAssessment;
};

export type PublicAssessmentQuestion = {
  id: string;
  topicId: string;
  topicTitle: string;
  moduleId: string;
  prompt: string;
  questionType: "knowledge" | "scenario";
  difficulty: "easy" | "medium" | "hard";
  options: Array<{ id: string; label: string }>;
};

export type StartTopicAssessmentResult =
  | {
      ok: true;
      attemptId: string;
      questions: PublicAssessmentQuestion[];
    }
  | {
      ok: false;
      error: string;
    };

export type TopicAssessmentReport = {
  attemptId: string;
  score: number | null;
  correctCount: number;
  questionCount: number;
  topics: Array<{
    topicId: string;
    topicTitle: string;
    moduleId: string;
    moduleTitle: string;
    selfAssessment: TopicSelfAssessment;
    status:
      | "self_reported_unknown"
      | "screening_passed"
      | "needs_review"
      | "needs_learning";
    score: number | null;
    correctCount: number;
    questionCount: number;
    confidence: "low" | "medium" | null;
  }>;
  questions: Array<{
    questionId: string;
    topicId: string;
    prompt: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  recommendedStart: {
    topicId: string;
    topicTitle: string;
    moduleId: string;
    moduleTitle: string;
  } | null;
  completedAt: string;
};

type AssessmentTopic = {
  id: string;
  legacy_topic_id: string | null;
  roadmap_module_id: string;
  title: string;
  description: string;
  sort_order: number;
  pass_percentage: number;
};

type AssessmentModule = {
  id: string;
  module_key: string;
  title: string;
  sort_order: number;
};

type AssessmentQuestion = {
  id: string;
  topic_id: string;
  prompt: string;
  question_type: "knowledge" | "scenario";
  difficulty: "easy" | "medium" | "hard";
  options: unknown;
  correct_option_id: string;
  explanation: string;
  version: number;
};

async function loadAssessmentContext(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data: enrollment, error: enrollmentError } = await admin
    .from("roadmap_enrollments")
    .select("id, user_id, roadmap_version_id, track_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment) return null;

  const [{ data: modules, error: modulesError }, { data: topics, error: topicsError }] =
    await Promise.all([
      admin
        .from("roadmap_modules")
        .select("id, module_key, title, sort_order")
        .eq("roadmap_version_id", enrollment.roadmap_version_id)
        .eq("is_active", true),
      admin
        .from("roadmap_topics")
        .select(
          "id, legacy_topic_id, roadmap_module_id, title, description, sort_order, pass_percentage",
        )
        .eq("roadmap_version_id", enrollment.roadmap_version_id)
        .eq("is_active", true),
    ]);

  if (modulesError) throw modulesError;
  if (topicsError) throw topicsError;

  const dynamicTopics = (topics ?? []) as AssessmentTopic[];
  const legacyTopicIds = dynamicTopics
    .map((topic) => topic.legacy_topic_id)
    .filter((topicId): topicId is string => Boolean(topicId));

  let questions: AssessmentQuestion[] = [];
  if (legacyTopicIds.length > 0) {
    const { data: questionRows, error: questionError } = await admin
      .from("topic_assessment_questions")
      .select(
        "id, topic_id, prompt, question_type, difficulty, options, correct_option_id, explanation, version",
      )
      .in("topic_id", legacyTopicIds)
      .eq("is_active", true);

    if (questionError) throw questionError;
    questions = (questionRows ?? []) as AssessmentQuestion[];
  }

  return {
    enrollment,
    modules: (modules ?? []) as AssessmentModule[],
    topics: dynamicTopics,
    questions,
  };
}

function getValidQuestions(
  questions: AssessmentQuestion[],
  legacyTopicId: string,
) {
  return questions.filter((question) => {
    if (question.topic_id !== legacyTopicId || !Array.isArray(question.options)) {
      return false;
    }

    const options = question.options as Array<{ id?: unknown }>;
    return (
      options.length >= 2 &&
      options.some((option) => option.id === question.correct_option_id)
    );
  });
}

export async function startTopicAssessmentAction(
  selections: TopicSelectionInput[],
): Promise<StartTopicAssessmentResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: "Your session has expired. Please sign in again.",
    };
  }

  if (
    !Array.isArray(selections) ||
    selections.length === 0 ||
    selections.length > 50
  ) {
    return {
      ok: false,
      error: "Choose at least one topic to continue.",
    };
  }

  const seen = new Set<string>();

  for (const item of selections) {
    if (
      !item ||
      typeof item.topicId !== "string" ||
      !["know", "unknown", "unsure"].includes(item.selfAssessment) ||
      seen.has(item.topicId)
    ) {
      return {
        ok: false,
        error: "The topic selection is invalid. Please review it.",
      };
    }

    seen.add(item.topicId);
  }

  const topicsToTest = selections.filter(
    (item) =>
      item.selfAssessment === "know" ||
      item.selfAssessment === "unsure",
  );

  if (topicsToTest.length > 6) {
    return {
      ok: false,
      error:
        "Choose up to 6 topics to test in one session. You can assess more topics in another session.",
    };
  }

  try {
    const admin = createAdminClient();
    const context = await loadAssessmentContext(admin, user.id);

    if (!context) {
      return {
        ok: false,
        error: "Your roadmap enrollment is not available. Refresh and try again.",
      };
    }

    const topicsById = new Map(context.topics.map((topic) => [topic.id, topic]));
    const modulesById = new Map(context.modules.map((module) => [module.id, module]));
    const selectedTopics = selections.map((selection) => topicsById.get(selection.topicId));

    if (
      selectedTopics.some((topic) => !topic || !topic.legacy_topic_id)
    ) {
      return {
        ok: false,
        error:
          "One or more selected topics are not mapped to the assessment bank yet. Choose an available topic and try again.",
      };
    }

    const questionSnapshot: Array<Record<string, unknown>> = [];
    const publicQuestions: PublicAssessmentQuestion[] = [];

    for (const selection of topicsToTest) {
      const topic = topicsById.get(selection.topicId);
      const roadmapModule = topic
        ? modulesById.get(topic.roadmap_module_id)
        : null;
      const available = topic?.legacy_topic_id
        ? getValidQuestions(context.questions, topic.legacy_topic_id)
        : [];

      if (!topic || !roadmapModule || available.length < 2) {
        return {
          ok: false,
          error: `The assessment for "${
            topic?.title ?? "this topic"
          }" is not ready yet. An admin must publish at least 2 valid mapped questions for it.`,
        };
      }

      const chosen = [...available]
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);

      for (const question of chosen) {
        const options = question.options as Array<{
          id: string;
          label: string;
        }>;

        // Store the legacy question/topic identity only because the existing
        // secure completion RPC validates against those tables. The selected
        // dynamic roadmap topic is preserved alongside it for the report.
        questionSnapshot.push({
          id: question.id,
          topic_id: topic.legacy_topic_id,
          roadmap_topic_id: topic.id,
          prompt: question.prompt,
          question_type: question.question_type,
          difficulty: question.difficulty,
          options,
          correct_option_id: question.correct_option_id,
          explanation: question.explanation,
          version: question.version,
        });

        // Never send the correct answer to the client.
        publicQuestions.push({
          id: question.id,
          topicId: topic.id,
          topicTitle: topic.title,
          moduleId: roadmapModule.module_key,
          prompt: question.prompt,
          questionType: question.question_type,
          difficulty: question.difficulty,
          options,
        });
      }
    }

    // Save the selected starting path.
    // Upsert also handles users whose profile row does not exist yet.
    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          selected_start_path: "placement",
        },
        {
          onConflict: "id",
        },
      );

    if (profileError) {
      console.error("Failed to save assessment path:", profileError);
      throw profileError;
    }

    // Create the assessment attempt.
    const { data: attempt, error: attemptError } = await admin
      .from("topic_assessment_attempts")
      .insert({
        user_id: user.id,
        status: "in_progress",
        selections: selections.map((item) => ({
          topic_id: topicsById.get(item.topicId)?.legacy_topic_id,
          roadmap_topic_id: item.topicId,
          self_assessment: item.selfAssessment,
        })),
        question_snapshot: questionSnapshot,
        total_questions: questionSnapshot.length,
      })
      .select("id")
      .single();

    if (attemptError) throw attemptError;

    return {
      ok: true,
      attemptId: attempt.id,
      questions: publicQuestions,
    };
  } catch (error) {
    console.error("Failed to start topic assessment:", error);

    return {
      ok: false,
      error: "We couldn't prepare your assessment. Please try again.",
    };
  }
}

export async function submitTopicAssessmentAction(
  attemptId: string,
  answers: Record<string, string>,
): Promise<
  | { ok: true; report: TopicAssessmentReport }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: "Your session has expired. Please sign in again.",
    };
  }

  if (
    !attemptId ||
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    return {
      ok: false,
      error: "The submitted assessment data is invalid.",
    };
  }

  const { data, error } = await supabase.rpc(
    "complete_topic_assessment",
    {
      p_attempt_id: attemptId,
      p_answers: answers,
    },
  );

  if (error) {
    console.error("Failed to complete topic assessment:", error);

    return {
      ok: false,
      error: error.message.includes(
        "Answer every displayed question",
      )
        ? "Please answer every question before submitting."
        : "We couldn't save your assessment. Your result has not been confirmed. Please try again.",
    };
  }

  try {
    const admin = createAdminClient();
    const context = await loadAssessmentContext(admin, user.id);

    if (!context) {
      return {
        ok: false,
        error: "Your roadmap enrollment is no longer available. Please refresh and try again.",
      };
    }

    const modulesById = new Map(context.modules.map((module) => [module.id, module]));
    const modulesByKey = new Map(context.modules.map((module) => [module.module_key, module]));
    const topicsByLegacyId = new Map(
      context.topics
        .filter((topic) => topic.legacy_topic_id)
        .map((topic) => [topic.legacy_topic_id as string, topic]),
    );
    const topicRanks = new Map(
      context.topics.map((topic) => {
        const roadmapModule = modulesById.get(topic.roadmap_module_id);
        return [
          topic.id,
          (roadmapModule?.sort_order ?? 0) * 100000 + topic.sort_order,
        ];
      }),
    );

    const rawReport = data as TopicAssessmentReport;
    const topics = rawReport.topics.map((topic) => {
      const dynamicTopic = topicsByLegacyId.get(topic.topicId);
      const roadmapModule = dynamicTopic
        ? modulesById.get(dynamicTopic.roadmap_module_id)
        : modulesByKey.get(topic.moduleId);
      const score = topic.score;
      const passPercentage = dynamicTopic?.pass_percentage ?? 100;
      const status: TopicAssessmentReport["topics"][number]["status"] =
        topic.selfAssessment === "unknown"
          ? "self_reported_unknown"
          : score !== null && score >= passPercentage
            ? "screening_passed"
            : score === 0
              ? "needs_learning"
              : "needs_review";

      return {
        ...topic,
        topicId: dynamicTopic?.id ?? topic.topicId,
        moduleId: roadmapModule?.module_key ?? topic.moduleId,
        moduleTitle: roadmapModule?.title ?? topic.moduleTitle,
        status,
      };
    });

    const questions = rawReport.questions.map((question) => ({
      ...question,
      topicId: topicsByLegacyId.get(question.topicId)?.id ?? question.topicId,
    }));
    const selectedTopicIds = new Set(topics.map((topic) => topic.topicId));
    const orderedSelectedTopics = [...topics].sort(
      (a, b) =>
        (topicRanks.get(a.topicId) ?? Number.MAX_SAFE_INTEGER) -
        (topicRanks.get(b.topicId) ?? Number.MAX_SAFE_INTEGER),
    );
    const firstUnmastered = orderedSelectedTopics.find(
      (topic) => topic.status !== "screening_passed",
    );
    const highestSelectedRank = Math.max(
      ...orderedSelectedTopics.map(
        (topic) => topicRanks.get(topic.topicId) ?? 0,
      ),
    );
    const orderedRoadmapTopics = [...context.topics].sort((a, b) => {
      const aRank = topicRanks.get(a.id) ?? 0;
      const bRank = topicRanks.get(b.id) ?? 0;
      return aRank - bRank;
    });
    const nextRoadmapTopic =
      orderedRoadmapTopics.find(
        (topic) =>
          (topicRanks.get(topic.id) ?? 0) > highestSelectedRank &&
          !selectedTopicIds.has(topic.id),
      ) ?? orderedRoadmapTopics.find((topic) => !selectedTopicIds.has(topic.id));
    const recommendedTopic = firstUnmastered
      ? context.topics.find((topic) => topic.id === firstUnmastered.topicId)
      : nextRoadmapTopic;
    const recommendedModule = recommendedTopic
      ? modulesById.get(recommendedTopic.roadmap_module_id)
      : null;

    const report: TopicAssessmentReport = {
      ...rawReport,
      topics,
      questions,
      recommendedStart: recommendedTopic && recommendedModule
        ? {
            topicId: recommendedTopic.id,
            topicTitle: recommendedTopic.title,
            moduleId: recommendedModule.module_key,
            moduleTitle: recommendedModule.title,
          }
        : null,
    };

    const { error: reportError } = await admin
      .from("topic_assessment_attempts")
      .update({ report })
      .eq("id", attemptId)
      .eq("user_id", user.id);

    if (reportError) throw reportError;

    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    revalidatePath("/roadmap");
    revalidatePath("/profile");

    return { ok: true, report };
  } catch (reportError) {
    console.error("Failed to enrich topic assessment report:", reportError);

    return {
      ok: false,
      error: "We couldn't save the roadmap recommendation. Please try again.",
    };
  }
}
