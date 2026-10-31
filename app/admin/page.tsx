import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Settings2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="page-container">
      <header className="page-heading">
        <span className="eyebrow">
          <Settings2 size={15} /> Admin workspace
        </span>
        <h1>Content Management</h1>
        <p>
          Manage the learning roadmap, its modules, topics, lessons, resources,
          and assessments from one place.
        </p>
      </header>

      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Roadmap Builder</h2>
              <p className="stat-note mt-1 max-w-2xl">
                Build and maintain the Full-Stack Development roadmap. Manage
                modules, prerequisites, topics, lessons, learning resources,
                and quizzes in the draft version.
              </p>
            </div>
          </div>

          <Link
            href="/admin/roadmap"
            className="button-primary inline-flex items-center gap-2"
          >
            Open Roadmap Admin
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <p className="stat-note mt-5">
        Changes made in the builder remain in Draft until the roadmap is
        validated and published.
      </p>
    </div>
  );
}
