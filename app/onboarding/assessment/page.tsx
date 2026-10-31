import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateStudentEnrollment } from "@/lib/roadmap-student";
import TopicAssessmentClient from "@/components/topic-assessment-client";

export default async function PlacementAssessmentPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const enrollment = await getOrCreateStudentEnrollment(user.id);
  if (!enrollment) {
    return (
      <div className="page-container">
        <Link href="/onboarding" className="text-link inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to starting options
        </Link>
        <section className="panel mt-5 p-6">
          <h1 className="text-2xl font-bold">Assessment is not available yet</h1>
          <p className="stat-note mt-2">
            A published Full-Stack roadmap is required before your skills can be assessed.
          </p>
        </section>
      </div>
    );
  }

  const admin = createAdminClient();
  const [modulesResult, topicsResult] = await Promise.all([
    admin
      .from("roadmap_modules")
      .select("id, module_key, title, sort_order")
      .eq("roadmap_version_id", enrollment.roadmap_version_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("roadmap_topics")
      .select(
        "id, legacy_topic_id, roadmap_module_id, title, description, sort_order, pass_percentage",
      )
      .eq("roadmap_version_id", enrollment.roadmap_version_id)
      .eq("is_active", true),
  ]);

  if (modulesResult.error) {
    console.error("Failed to load assessment modules:", modulesResult.error);
  }
  if (topicsResult.error) {
    console.error("Failed to load assessment topics:", topicsResult.error);
  }

  const modules = modulesResult.data ?? [];
  const topicsResultData = topicsResult.data ?? [];
  const legacyTopicIds = topicsResultData
    .map((topic) => topic.legacy_topic_id)
    .filter((topicId): topicId is string => Boolean(topicId));

  const { data: questions, error: questionsError } = legacyTopicIds.length
    ? await admin
        .from("topic_assessment_questions")
        .select("topic_id, options, correct_option_id, is_active")
        .in("topic_id", legacyTopicIds)
        .eq("is_active", true)
    : { data: [], error: null };

  if (questionsError) {
    console.error("Failed to count assessment questions:", questionsError);
  }

  const questionCounts = new Map<string, number>();
  for (const question of questions ?? []) {
    const options = Array.isArray(question.options) ? question.options : [];
    const hasValidAnswer = options.some(
      (option) =>
        typeof option === "object" &&
        option !== null &&
        "id" in option &&
        option.id === question.correct_option_id,
    );

    if (options.length >= 2 && hasValidAnswer) {
      questionCounts.set(
        question.topic_id,
        (questionCounts.get(question.topic_id) ?? 0) + 1,
      );
    }
  }

  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const topics = topicsResultData
    .map((topic) => {
      const roadmapModule = modulesById.get(topic.roadmap_module_id);
      const questionCount = topic.legacy_topic_id
        ? questionCounts.get(topic.legacy_topic_id) ?? 0
        : 0;

      return {
        id: topic.id,
        roadmapModuleId: topic.roadmap_module_id,
        moduleId: roadmapModule?.module_key ?? topic.roadmap_module_id,
        moduleTitle: roadmapModule?.title ?? "Roadmap module",
        moduleSortOrder: roadmapModule?.sort_order ?? 0,
        sortOrder: topic.sort_order,
        passPercentage: topic.pass_percentage,
        assessmentMapped: Boolean(topic.legacy_topic_id),
        title: topic.title,
        description: topic.description,
        questionCount,
      };
    })
    .filter((topic) => modulesById.has(topic.roadmapModuleId));

  const orderedTopics = topics.sort(
    (a, b) => a.moduleSortOrder - b.moduleSortOrder || a.sortOrder - b.sortOrder,
  );
  const assessableTopics = orderedTopics.filter(
    (topic) => topic.assessmentMapped && topic.questionCount >= 2,
  );
  const unavailableTopics = orderedTopics.filter(
    (topic) => !topic.assessmentMapped || topic.questionCount < 2,
  );

  return (
    <div className="page-container">
      <Link href="/onboarding" className="text-link inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to starting options
      </Link>
      <header className="quiz-header">
        <span className="eyebrow">Personalized skill assessment</span>
        <h1>Choose what you want to assess</h1>
        <p>
          Select specific topics from your assigned Full-Stack roadmap. We will
          test only topics with a verified question bank and calculate your
          results on the server.
        </p>
      </header>
      {orderedTopics.length > 0 ? (
        <TopicAssessmentClient
          topics={assessableTopics}
          unavailableTopics={unavailableTopics}
        />
      ) : (
        <section className="panel p-6">
          <h2>Assessment topics are not available yet</h2>
          <p className="stat-note">
            The assigned roadmap does not contain active topics yet. Please contact
            the Masarak team.
          </p>
        </section>
      )}
    </div>
  );
}
