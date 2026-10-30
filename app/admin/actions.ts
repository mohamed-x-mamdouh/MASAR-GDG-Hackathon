"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createTopicAction(formData: FormData) {
  await requireAdmin();

  const moduleId = getText(formData, "moduleId");
  const slug = getText(formData, "slug").toLowerCase();
  const title = getText(formData, "title");
  const description = getText(formData, "description");
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!curriculum.some((item) => item.id === moduleId)) {
    throw new Error("Choose a valid roadmap module.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !title) {
    throw new Error("Enter a title and a URL-safe topic slug.");
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new Error("Sort order must be a non-negative integer.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("learning_topics").insert({
    module_id: moduleId,
    slug,
    title,
    description,
    sort_order: sortOrder,
    is_active: true,
  });

  if (error) {
    console.error("Failed to create topic:", error);
    throw new Error(error.code === "23505" ? "This topic slug already exists in that module." : "Couldn't create the topic.");
  }

  revalidatePath("/admin");
  revalidatePath("/onboarding/assessment");
  redirect("/admin");
}

export async function createTopicQuestionAction(formData: FormData) {
  await requireAdmin();

  const topicId = getText(formData, "topicId");
  const prompt = getText(formData, "prompt");
  const questionType = getText(formData, "questionType");
  const difficulty = getText(formData, "difficulty");
  const optionA = getText(formData, "optionA");
  const optionB = getText(formData, "optionB");
  const optionC = getText(formData, "optionC");
  const correctOptionId = getText(formData, "correctOptionId");
  const explanation = getText(formData, "explanation");

  if (!topicId || !prompt || !optionA || !optionB || !optionC) {
    throw new Error("Complete the question and all three answer options.");
  }
  if (!(["knowledge", "scenario"] as string[]).includes(questionType)) {
    throw new Error("Choose a valid question type.");
  }
  if (!["easy", "medium", "hard"].includes(difficulty)) {
    throw new Error("Choose a valid difficulty.");
  }
  if (!["a", "b", "c"].includes(correctOptionId)) {
    throw new Error("Choose the correct answer.");
  }

  const admin = createAdminClient();
  const { data: topic, error: topicError } = await admin
    .from("learning_topics")
    .select("id")
    .eq("id", topicId)
    .eq("is_active", true)
    .maybeSingle();

  if (topicError || !topic) throw new Error("Topic not found or inactive.");

  const { data: previous, error: previousError } = await admin
    .from("topic_assessment_questions")
    .select("version")
    .eq("topic_id", topicId)
    .order("version", { ascending: false })
    .limit(1);

  if (previousError) throw new Error("Couldn't read the current question version.");

  const version = (previous?.[0]?.version ?? 0) + 1;
  const { error } = await admin.from("topic_assessment_questions").insert({
    topic_id: topicId,
    prompt,
    question_type: questionType,
    difficulty,
    options: [
      { id: "a", label: optionA },
      { id: "b", label: optionB },
      { id: "c", label: optionC },
    ],
    correct_option_id: correctOptionId,
    explanation,
    version,
    is_active: true,
  });

  if (error) {
    console.error("Failed to create topic question:", error);
    throw new Error("Couldn't save this question.");
  }

  revalidatePath(`/admin/topics/${topicId}`);
  revalidatePath("/onboarding/assessment");
  redirect(`/admin/topics/${topicId}`);
}


export async function updateTopicDetailsAction(formData: FormData) {
  await requireAdmin();
  const topicId = getText(formData, "topicId");
  const title = getText(formData, "title");
  const description = getText(formData, "description");
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  if (!topicId || !title || !Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new Error("Enter a valid topic title and sort order.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("learning_topics")
    .update({ title, description, sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", topicId);
  if (error) throw new Error("Couldn't update this topic.");
  revalidatePath("/admin");
  revalidatePath(`/admin/topics/${topicId}`);
  revalidatePath("/onboarding/assessment");
  redirect(`/admin/topics/${topicId}`);
}

export async function archiveTopicQuestionAction(formData: FormData) {
  await requireAdmin();
  const topicId = getText(formData, "topicId");
  const questionId = getText(formData, "questionId");
  if (!topicId || !questionId) throw new Error("Missing question details.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("topic_assessment_questions")
    .update({ is_active: false })
    .eq("id", questionId)
    .eq("topic_id", topicId);

  if (error) throw new Error("Couldn't archive this question.");
  revalidatePath(`/admin/topics/${topicId}`);
  revalidatePath("/onboarding/assessment");
  redirect(`/admin/topics/${topicId}`);
}

export async function archiveTopicAction(formData: FormData) {
  await requireAdmin();
  const topicId = getText(formData, "topicId");
  if (!topicId) throw new Error("Missing topic id.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("learning_topics")
    .update({ is_active: false })
    .eq("id", topicId);

  if (error) throw new Error("Couldn't archive this topic.");
  revalidatePath("/admin");
  revalidatePath("/onboarding/assessment");
  redirect("/admin");
}
