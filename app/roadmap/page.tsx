import type { Metadata } from "next";
import RoadmapClient from "@/components/roadmap-client";

export const metadata: Metadata = {
  title: "Learning Roadmap",
  description: "Explore the complete Full-Stack Development learning path.",
};

export default function RoadmapPage() {
  return <RoadmapClient />;
}
