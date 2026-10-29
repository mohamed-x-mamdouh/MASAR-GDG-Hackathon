import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlacementAssessmentClient from "@/components/placement-assessment-client";

export default async function PlacementAssessmentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="page-container">
      <header className="quiz-header">
        <span className="eyebrow">Initial skills assessment</span>

        <h1>Let&apos;s find your starting point</h1>

        <p>
          Answer the questions based on what you can confidently
          explain or do. Your CV is optional and is not treated as
          proof that you have mastered a skill.
        </p>
      </header>

      <PlacementAssessmentClient />
    </div>
  );
}