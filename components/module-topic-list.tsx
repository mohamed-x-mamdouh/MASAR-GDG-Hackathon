import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const labels: Record<string, string> = {
  screening_passed: "Screening passed",
  needs_review: "Needs review",
  needs_learning: "Start learning",
  self_reported_unknown: "Not known yet",
};

type Props = { moduleId: string };

export default async function ModuleTopicList({ moduleId }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: topics, error } = await admin
    .from("learning_topics")
    .select("id, title, description, sort_order")
    .eq("module_id", moduleId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to load module topics:", error);
    return null;
  }
  if (!topics || topics.length === 0) return null;

  const masteryResult = user
    ? await admin
        .from("student_topic_mastery")
        .select("topic_id, result_status")
        .eq("user_id", user.id)
        .in("topic_id", topics.map((topic) => topic.id))
    : { data: [], error: null };

  if (masteryResult.error) {
    console.error("Failed to load student topic mastery:", masteryResult.error);
  }

  const mastery = new Map((masteryResult.data ?? []).map((item) => [item.topic_id, item.result_status]));

  return (
    <section className="panel detail-section">
      <h2>Topics in this module</h2>
      <p className="stat-note">Your progress is tracked topic by topic, so you can focus on specific gaps instead of repeating the whole module.</p>
      <div className="mt-4 space-y-3">
        {topics.map((topic) => {
          const status = mastery.get(topic.id);
          return (
            <article className="topic-result-row" id={`topic-${topic.id}`} key={topic.id}>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{topic.title}</h3>
                {topic.description && <p className="stat-note">{topic.description}</p>}
              </div>
              <span className={`topic-status-badge ${status ?? "not_assessed"}`}>
                {status ? labels[status] ?? status : "Not assessed"}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
