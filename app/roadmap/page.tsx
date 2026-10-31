import type { Metadata } from "next";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStudentRoadmapData } from "@/lib/roadmap-student";
import RoadmapClient from "@/components/roadmap-client";

export const metadata: Metadata = {
  title: "Learning Roadmap",
  description: "Explore the complete Full-Stack Development learning path.",
};

export default async function RoadmapPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await getStudentRoadmapData(user?.id);

  return <RoadmapClient data={data} isAuthenticated={Boolean(user)} />;
}