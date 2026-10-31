"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateStudentEnrollment } from "@/lib/roadmap-student";
import { revalidatePath } from "next/cache";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Server action to mark a lesson completed or uncompleted.
 */
export async function toggleLessonProgressAction(
  formData: FormData,
): Promise<void> {
  const lessonId = formData.get("lessonId");
  const completed = formData.get("completed");
  const moduleKey = formData.get("moduleKey");

  if (typeof lessonId !== "string" || !isValidUuid(lessonId)) {
    throw new Error("Invalid lesson ID.");
  }

  const shouldComplete = completed === "true" || completed === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to update your progress.");
  }

  const enrollment = await getOrCreateStudentEnrollment(user.id);
  if (!enrollment) {
    throw new Error("No active enrollment found for your account.");
  }

  const admin = createAdminClient();

  // Verify the lesson exists, is active, and matches enrollment's roadmap version
  const { data: lesson, error: lessonError } = await admin
    .from("learning_lessons")
    .select("id, roadmap_topic_id, roadmap_version_id, is_active")
    .eq("id", lessonId)
    .eq("roadmap_version_id", enrollment.roadmap_version_id)
    .eq("is_active", true)
    .maybeSingle();

  if (lessonError || !lesson) {
    throw new Error("Lesson not found in your assigned roadmap version.");
  }

  const { data: topic, error: topicError } = await admin
    .from("roadmap_topics")
    .select("roadmap_module_id")
    .eq("id", lesson.roadmap_topic_id)
    .eq("roadmap_version_id", enrollment.roadmap_version_id)
    .eq("is_active", true)
    .maybeSingle();

  if (topicError || !topic) {
    throw new Error("Lesson topic not found in your assigned roadmap version.");
  }

  const { data: moduleUnlocked, error: accessError } = await admin.rpc(
    "is_roadmap_module_unlocked",
    {
      p_user_id: user.id,
      p_enrollment_id: enrollment.id,
      p_module_id: topic.roadmap_module_id,
    },
  );

  if (accessError || moduleUnlocked !== true) {
    throw new Error("This lesson is locked until its module is unlocked.");
  }

  if (shouldComplete) {
    const { error: upsertError } = await admin
      .from("student_lesson_progress")
      .upsert(
        {
          user_id: user.id,
          enrollment_id: enrollment.id,
          roadmap_version_id: enrollment.roadmap_version_id,
          lesson_id: lesson.id,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "enrollment_id,lesson_id" },
      );

    if (upsertError) {
      console.error("Failed to mark lesson complete:", upsertError);
      throw new Error("Failed to save progress. Please try again.");
    }
  } else {
    const { error: deleteError } = await admin
      .from("student_lesson_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("enrollment_id", enrollment.id)
      .eq("lesson_id", lesson.id);

    if (deleteError) {
      console.error("Failed to remove lesson progress:", deleteError);
      throw new Error("Failed to update progress. Please try again.");
    }
  }

  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
  if (typeof moduleKey === "string" && moduleKey.length > 0) {
    revalidatePath(`/roadmap/${moduleKey}`);
  }
}
