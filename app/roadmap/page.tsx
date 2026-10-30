import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RoadmapClient, {
  type ModuleTopicSummary,
} from "@/components/roadmap-client";
import { curriculum } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Learning Roadmap",
  description:
    "Explore the complete learning roadmap and your topic-level progress.",
};

export default async function RoadmapPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: topics, error: topicsError } = await admin
    .from("learning_topics")
    .select("id, module_id")
    .eq("is_active", true);

  if (topicsError) {
    console.error("Failed to load roadmap topics:", topicsError);
  }

  const topicIds = (topics ?? []).map((topic) => topic.id);
  const masteryByTopic = new Map<string, string>();

  if (user && topicIds.length > 0) {
    const { data: mastery, error: masteryError } = await admin
      .from("student_topic_mastery")
      .select("topic_id, result_status")
      .eq("user_id", user.id)
      .in("topic_id", topicIds);

    if (masteryError) {
      console.error("Failed to load roadmap topic progress:", masteryError);
    }

    for (const row of mastery ?? []) {
      masteryByTopic.set(row.topic_id, row.result_status);
    }
  }

  const summaries: Record<string, ModuleTopicSummary> = {};

  for (const roadmapModule of curriculum) {
    summaries[roadmapModule.id] = {
      total: 0,
      screeningPassed: 0,
      needsReview: 0,
      needsLearning: 0,
      notAssessed: 0,
    };
  }

  for (const topic of topics ?? []) {
    const summary = summaries[topic.module_id];
    if (!summary) continue;

    summary.total += 1;
    const status = masteryByTopic.get(topic.id);

    if (status === "screening_passed") summary.screeningPassed += 1;
    else if (status === "needs_review") summary.needsReview += 1;
    else if (status === "needs_learning" || status === "self_reported_unknown")
      summary.needsLearning += 1;
    else summary.notAssessed += 1;
  }

  return <RoadmapClient topicSummaries={summaries} />;
}
