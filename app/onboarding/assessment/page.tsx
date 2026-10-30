import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import PlacementAssessmentClient from "@/components/placement-assessment-client";
import { connection } from "next/server";

export default async function PlacementAssessmentPage() {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="page-container">
      <Link
        href="/onboarding"
        className="text-link inline-flex items-center gap-2"
      >
        <ArrowLeft size={17} />
        Back to starting options
      </Link>

      <header className="quiz-header">
        <span className="eyebrow">
          Initial skills assessment
        </span>

        <h1>Let&apos;s find your starting point</h1>

        <p>
          Answer based on what you can confidently explain
          or do. Your CV is optional and is not treated as
          proof that you have mastered a skill.
        </p>
      </header>

      <PlacementAssessmentClient />
    </div>
  );
}