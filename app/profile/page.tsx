import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("selected_start_path")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    "Student";

  const startPathLabel =
    profile?.selected_start_path === "placement"
      ? "Skills assessment"
      : profile?.selected_start_path === "beginner"
        ? "Starting from scratch"
        : "Not selected yet";

  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">Your account</span>

        <h1>My Profile</h1>

        <p>
          Review your account information and manage
          your learning journey.
        </p>
      </div>

      <section className="panel p-6">
        <h2 className="text-xl font-semibold">
          Account information
        </h2>

        <div className="mt-6 grid gap-5">
          <div>
            <p className="text-sm text-gray-500">
              Full name
            </p>
            <p className="font-medium">
              {displayName}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Email
            </p>
            <p className="font-medium">
              {user.email}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Starting path
            </p>
            <p className="font-medium">
              {startPathLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="text-xl font-semibold">
          Learning journey
        </h2>

        <p className="mt-2 text-gray-500">
          Your learning path is still customizable.
          You can review your roadmap or reassess your
          current skills.
        </p>

        <div className="dashboard-actions mt-5">
          <Link
            href="/dashboard"
            className="button-primary"
          >
            Open dashboard
          </Link>

          <Link
            href="/onboarding/assessment"
            className="button-secondary"
          >
            Assess my skills
          </Link>

          {!profile?.selected_start_path && (
            <Link
              href="/onboarding"
              className="button-secondary"
            >
              Choose starting path
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}