import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";
import TopicAssessmentClient from "@/components/topic-assessment-client";

export default async function PlacementAssessmentPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const [topicsResult, questionsResult] = await Promise.all([
    admin
      .from("learning_topics")
      .select("id, module_id, title, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("topic_assessment_questions")
      .select("topic_id")
      .eq("is_active", true),
  ]);

  if (topicsResult.error) {
    console.error("Failed to load assessment topics:", topicsResult.error);
  }
  if (questionsResult.error) {
    console.error("Failed to count assessment questions:", questionsResult.error);
  }

  const questionCounts = new Map<string, number>();
  for (const question of questionsResult.data ?? []) {
    questionCounts.set(
      question.topic_id,
      (questionCounts.get(question.topic_id) ?? 0) + 1,
    );
  }

  const modulesById = new Map(curriculum.map((item) => [item.id, item.title]));
  const topics = (topicsResult.data ?? [])
    .filter((topic) => modulesById.has(topic.module_id))
    .map((topic) => ({
      id: topic.id,
      moduleId: topic.module_id,
      moduleTitle: modulesById.get(topic.module_id) ?? topic.module_id,
      title: topic.title,
      description: topic.description,
      questionCount: questionCounts.get(topic.id) ?? 0,
    }));

  return (
    <div className="page-container">
      <Link href="/onboarding" className="text-link inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to starting options
      </Link>
      <header className="quiz-header">
        <span className="eyebrow">Personalized skill assessment</span>
        <h1>Choose what you already know</h1>
        <p>
          Tell us which topics you know, which you want to learn, and which
          you are unsure about. We will only test the topics you say you know
          or are unsure about. Each session contains up to 12 questions.
          CV extraction is not enabled in this release; manual skill selection is available now.
        </p>
      </header>
      {topics.length > 0 ? (
        <TopicAssessmentClient topics={topics} />
      ) : (
        <section className="panel p-6">
          <h2>Assessment topics are not available yet</h2>
          <p className="stat-note">
            The assessment catalog has not been configured. Please contact
            the Masarak team.
          </p>
        </section>
      )}
    </div>
  );
}
