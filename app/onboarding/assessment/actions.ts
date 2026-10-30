"use server";

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
  | { ok: true; attemptId: string; questions: PublicAssessmentQuestion[] }
  | { ok: false; error: string };

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
  completedAt: string;
};

export async function startTopicAssessmentAction(
  selections: TopicSelectionInput[],
): Promise<StartTopicAssessmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  if (!Array.isArray(selections) || selections.length === 0 || selections.length > 50) {
    return { ok: false, error: "Choose at least one topic to continue." };
  }

  const seen = new Set<string>();
  for (const item of selections) {
    if (
      !item ||
      typeof item.topicId !== "string" ||
      !["know", "unknown", "unsure"].includes(item.selfAssessment) ||
      seen.has(item.topicId)
    ) {
      return { ok: false, error: "The topic selection is invalid. Please review it." };
    }
    seen.add(item.topicId);
  }

  const topicsToTest = selections.filter(
    (item) => item.selfAssessment === "know" || item.selfAssessment === "unsure",
  );

  if (topicsToTest.length > 6) {
    return {
      ok: false,
      error: "Choose up to 6 topics to test in one session. You can assess more topics in another session.",
    };
  }

  try {
    const admin = createAdminClient();
    const { data: topics, error: topicsError } = await admin
      .from("learning_topics")
      .select("id, module_id, title, is_active")
      .in("id", selections.map((item) => item.topicId))
      .eq("is_active", true);

    if (topicsError) throw topicsError;
    if (!topics || topics.length !== selections.length) {
      return { ok: false, error: "One or more selected topics are no longer available. Refresh and try again." };
    }

    const questionSnapshot: Array<Record<string, unknown>> = [];
    const publicQuestions: PublicAssessmentQuestion[] = [];

    if (topicsToTest.length > 0) {
      const { data: bank, error: bankError } = await admin
        .from("topic_assessment_questions")
        .select("id, topic_id, prompt, question_type, difficulty, options, correct_option_id, explanation, version")
        .in("topic_id", topicsToTest.map((item) => item.topicId))
        .eq("is_active", true);

      if (bankError) throw bankError;

      for (const selection of topicsToTest) {
        const topic = topics.find((item) => item.id === selection.topicId);
        const available = (bank ?? []).filter((item) => item.topic_id === selection.topicId);

        if (available.length < 2) {
          return {
            ok: false,
            error: `The assessment for "${topic?.title ?? "this topic"}" is not ready yet. An admin must publish at least 2 questions for it.`,
          };
        }

        const chosen = [...available]
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);

        for (const question of chosen) {
          const options = Array.isArray(question.options)
            ? question.options as Array<{ id: string; label: string }>
            : [];

          const validAnswerExists = options.some(
            (option) => option.id === question.correct_option_id,
          );
          if (!validAnswerExists || options.length < 2) {
            return {
              ok: false,
              error: `A question in "${topic?.title ?? "this topic"}" has invalid answer data. Please contact the admin team.`,
            };
          }

          questionSnapshot.push({
            id: question.id,
            topic_id: question.topic_id,
            prompt: question.prompt,
            question_type: question.question_type,
            difficulty: question.difficulty,
            options,
            correct_option_id: question.correct_option_id,
            explanation: question.explanation,
            version: question.version,
          });

          publicQuestions.push({
            id: question.id,
            topicId: question.topic_id,
            topicTitle: topic?.title ?? "Topic",
            moduleId: topic?.module_id ?? "",
            prompt: question.prompt,
            questionType: question.question_type,
            difficulty: question.difficulty,
            options,
          });
        }
      }
    }

    const { data: attempt, error: attemptError } = await admin
      .from("topic_assessment_attempts")
      .insert({
        user_id: user.id,
        status: "in_progress",
        selections: selections.map((item) => ({
          topic_id: item.topicId,
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
): Promise<{ ok: true; report: TopicAssessmentReport } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  if (!attemptId || !answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { ok: false, error: "The submitted assessment data is invalid." };
  }

  const { data, error } = await supabase.rpc("complete_topic_assessment", {
    p_attempt_id: attemptId,
    p_answers: answers,
  });

  if (error) {
    console.error("Failed to complete topic assessment:", error);
    return {
      ok: false,
      error: error.message.includes("Answer every displayed question")
        ? "Please answer every question before submitting."
        : "We couldn't save your assessment. Your result has not been confirmed. Please try again.",
    };
  }

  return { ok: true, report: data as TopicAssessmentReport };
}
