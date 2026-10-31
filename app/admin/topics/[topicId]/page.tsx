import { redirect } from "next/navigation";

/**
 * Legacy Assessment Admin is retired.
 * New roadmap content must be managed through the versioned Roadmap Builder.
 */
export default function LegacyTopicAdminRedirect() {
  redirect("/admin/roadmap");
}
