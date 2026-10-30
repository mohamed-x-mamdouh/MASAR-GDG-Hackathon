import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Compass,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { beginFromScratchAction } from "@/app/onboarding/actions";
import { connection } from "next/server";

export default async function OnboardingPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("selected_start_path")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load onboarding profile:", error);
  }

  if (profile?.selected_start_path) {
    redirect("/dashboard");
  }

  return (
    <div className="page-container onboarding-page">
      <header className="onboarding-heading">
        <span className="eyebrow">
          <span className="eyebrow-dot" />
          Personalize your journey
        </span>

        <h1>Where would you like to start?</h1>

        <p>
          Everyone starts somewhere different. Choose the
          option that fits you, and Masarak will help you
          decide what to focus on next.
        </p>
      </header>

      <div className="onboarding-options">
        <section className="panel onboarding-option">
          <div className="onboarding-option-icon">
            <BookOpen size={25} />
          </div>

          <span className="onboarding-option-label">
            OPTION 01
          </span>

          <h2>Start from scratch</h2>

          <p>
            Begin with the foundations and move forward
            step by step. Choose this option if you prefer
            to learn everything from the beginning.
          </p>

          <form
            action={beginFromScratchAction}
            className="onboarding-option-action"
          >
            <button
              type="submit"
              className="button-primary onboarding-button"
            >
              Start learning
              <ArrowRight size={18} />
            </button>
          </form>
        </section>

        <section className="panel onboarding-option">
          <div className="onboarding-option-icon">
            <ClipboardCheck size={25} />
          </div>

          <span className="onboarding-option-label">
            OPTION 02
          </span>

          <h2>Assess my current skills</h2>

          <p>
            Select the topics you already know or are unsure about.
            Masarak will assess your knowledge and help you identify
            what to learn next.
          </p>

          <Link
            href="/onboarding/assessment"
            className="button-primary onboarding-button"
          >
            Take assessment
            <ArrowRight size={18} />
          </Link>
        </section>
      </div>

      <p className="onboarding-footnote">
        <Compass size={16} />
        The current assessment and learning stages are
        provisional and will be customized for Masarak.
      </p>
    </div>
  );
}