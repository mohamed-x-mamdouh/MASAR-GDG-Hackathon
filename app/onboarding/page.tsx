import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { beginFromScratchAction } from "@/app/onboarding/actions";

export default async function OnboardingPage() {
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

  if (profile?.selected_start_path) {
    redirect("/dashboard");
  }

  return (
    <div className="page-container">
      <header className="quiz-header">
        <span className="eyebrow">Let&apos;s personalize your journey</span>

        <h1>How would you like to start?</h1>

        <p>
          Start from the foundations, or take an initial skills
          assessment to identify topics you may already know.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-xl font-semibold">Start from scratch</h2>

          <p className="mt-3">
            Follow the learning path from the beginning, with no
            prior knowledge assumed.
          </p>

          <form action={beginFromScratchAction} className="mt-6">
            <button type="submit" className="button-primary">
              Start learning
            </button>
          </form>
        </section>

        <section className="panel p-6">
          <h2 className="text-xl font-semibold">
            Assess my current skills
          </h2>

          <p className="mt-3">
            Answer a provisional knowledge assessment. You can also
            attach your CV as extra context.
          </p>

          <Link
            href="/onboarding/assessment"
            className="button-primary mt-6"
          >
            Take assessment
          </Link>
        </section>
      </div>
    </div>
  );
}