"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";
import {
  evaluatePlacementAnswers,
  placementQuestions,
  placementModuleIds,
  placementFallbackModuleId,
  type PlacementSubmissionResult,
} from "@/lib/placement-assessment";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadata = user.user_metadata ?? {};

  const name =
    metadata.display_name ??
    metadata.full_name ??
    user.email?.split("@")[0] ??
    "Student";

  return typeof name === "string" ? name : "Student";
}

export async function beginFromScratchAction() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      display_name: getDisplayName(user),
      selected_start_path: "beginner",
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Failed to save beginner path:", error);
    throw new Error("Couldn't save your learning path. Please try again.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/roadmap");

  redirect("/dashboard");
}

export async function submitPlacementAssessmentAction(
  answers: Record<string, string>,
  cvStoragePath: string | null,
): Promise<PlacementSubmissionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: "Your session has expired. Sign in and try again.",
    };
  }

  if (
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    return {
      ok: false,
      error: "Invalid assessment answers.",
    };
  }

  if (
    Object.keys(answers).length !== placementQuestions.length ||
    !placementQuestions.every((question) => {
      const answer = answers[question.id];

      return (
        typeof answer === "string" &&
        question.options.some((option) => option.id === answer)
      );
    })
  ) {
    return {
      ok: false,
      error: "Answer every assessment question before submitting.",
    };
  }

  if (cvStoragePath !== null) {
    const safePath =
      typeof cvStoragePath === "string" &&
      cvStoragePath.startsWith(`${user.id}/`) &&
      !cvStoragePath.includes("..") &&
      !cvStoragePath.startsWith("/");

    if (!safePath) {
      return {
        ok: false,
        error: "The uploaded CV path is invalid.",
      };
    }
  }

  const evaluation = evaluatePlacementAnswers(answers);

  // Only validate a continuous sequence before the first unmet module.
  const validatedModuleIds: string[] = [];

  for (const moduleId of placementModuleIds) {
    const result = evaluation.modules.find(
      (item) => item.moduleId === moduleId,
    );

    if (!result?.mastered) {
      break;
    }

    validatedModuleIds.push(moduleId);
  }

  const recommendedStartModuleId =
    placementModuleIds[validatedModuleIds.length] ??
    placementFallbackModuleId;

  const recommendedModule = curriculum.find(
    (item) => item.id === recommendedStartModuleId,
  );

  if (!recommendedModule) {
    return {
      ok: false,
      error:
        "The recommended module isn't configured in the current roadmap.",
    };
  }

  let admin: ReturnType<typeof createAdminClient> | null = null;
  let placementAttemptId: string | null = null;

  try {
    admin = createAdminClient();

    if (cvStoragePath) {
      const fileName = cvStoragePath.slice(user.id.length + 1);

      const { data: files, error: fileError } = await admin.storage
        .from("student-cvs")
        .list(user.id, {
          search: fileName,
          limit: 100,
        });

      if (fileError) throw fileError;

      if (!files?.some((file) => file.name === fileName)) {
        return {
          ok: false,
          error: "We couldn't verify the uploaded CV. Please upload it again.",
        };
      }
    }

    const { data: attempt, error: attemptError } = await admin
      .from("placement_attempts")
      .insert({
        user_id: user.id,
        status: "pending",
        cv_storage_path: cvStoragePath,
        // CV extraction is not implemented yet; do not invent extracted skills.
        extracted_skills: [],
        skill_results: {
          assessment_version: "provisional-v1",
          modules: evaluation.modules,
        },
        overall_score: evaluation.overallScore,
        recommended_start_module_id: recommendedStartModuleId,
      })
      .select("id")
      .single();

    if (attemptError) throw attemptError;

    placementAttemptId = attempt.id;

    const { data: existingRows, error: existingError } = await admin
      .from("module_progress")
      .select("module_id, status")
      .eq("user_id", user.id)
      .in("module_id", [...placementModuleIds]);

    if (existingError) throw existingError;

    const existingStatus = new Map(
      (existingRows ?? []).map((row) => [row.module_id, row.status]),
    );

    const rowsToSave = validatedModuleIds
      .filter((moduleId) => existingStatus.get(moduleId) !== "completed")
      .map((moduleId) => {
        const result = evaluation.modules.find(
          (item) => item.moduleId === moduleId,
        );

        return {
          user_id: user.id,
          module_id: moduleId,
          status: "validated" as const,
          verification_source: "placement_assessment" as const,
          score: result?.score ?? 100,
          verified_at: new Date().toISOString(),
        };
      });

    if (rowsToSave.length > 0) {
      const { error: progressError } = await admin
        .from("module_progress")
        .upsert(rowsToSave, {
          onConflict: "user_id,module_id",
        });

      if (progressError) throw progressError;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          display_name: getDisplayName(user),
          selected_start_path: "placement",
        },
        { onConflict: "id" },
      );

    if (profileError) throw profileError;

    const { error: completedAttemptError } = await admin
      .from("placement_attempts")
      .update({ status: "completed" })
      .eq("id", placementAttemptId)
      .eq("user_id", user.id);

    if (completedAttemptError) throw completedAttemptError;

    revalidatePath("/dashboard");
    revalidatePath("/roadmap");
    revalidatePath("/profile");

    return {
      ok: true,
      overallScore: evaluation.overallScore,
      validatedModuleIds,
      recommendedStartModuleId,
      recommendedStartModuleTitle: recommendedModule.title,
    };
  } catch (error) {
    console.error("Placement assessment failed:", error);

    if (admin && placementAttemptId) {
      const { error: updateError } = await admin
        .from("placement_attempts")
        .update({ status: "failed" })
        .eq("id", placementAttemptId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Failed to update placement attempt:", updateError);
      }
    }

    return {
      ok: false,
      error:
        "We couldn't save the assessment. Please try again. Your answers haven't been confirmed as saved.",
    };
  }
}