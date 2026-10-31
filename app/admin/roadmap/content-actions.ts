"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const RESOURCE_TYPES = [
  "youtube_video",
  "documentation",
  "article",
  "external_course",
  "practice",
  "interactive",
  "pdf",
] as const;

const RESOURCE_LANGUAGES = ["en", "ar", "other"] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];
type ResourceLanguage = (typeof RESOURCE_LANGUAGES)[number];
type AdminClient = ReturnType<typeof createAdminClient>;

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

  if (error || profile?.role !== "admin") redirect("/dashboard");
  return user;
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getLines(formData: FormData, key: string) {
  return getText(formData, key)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getPositiveInteger(formData: FormData, key: string, fallback: number) {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function getOptionalNonNegativeInteger(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return null;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${key} must be zero or a positive integer, or left empty.`);
  }
  return value;
}

function getChecked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function getResourceType(value: string): ResourceType {
  if (!RESOURCE_TYPES.includes(value as ResourceType)) {
    throw new Error("Choose a valid resource type.");
  }
  return value as ResourceType;
}

function getResourceLanguage(value: string): ResourceLanguage {
  if (!RESOURCE_LANGUAGES.includes(value as ResourceLanguage)) {
    throw new Error("Choose a valid resource language.");
  }
  return value as ResourceLanguage;
}

function validateKey(value: string, label: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`${label} must be URL-safe, e.g. variables-and-types.`);
  }
}

function validateHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS links are allowed.");
    }
  } catch {
    throw new Error("Enter a valid URL beginning with http:// or https://.");
  }
}

function redirectWithFeedback(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`${path}?${params.toString()}`);
}

function getFriendlyDatabaseError(error: { code?: string; message?: string }, fallback: string) {
  console.error(fallback, error);
  if (error.code === "23505") {
    return "This key or sort order is already used in this parent item.";
  }
  if (error.code === "23514") {
    return "One of the selected values is not allowed by the database.";
  }
  if (error.code === "23503") {
    return "The selected topic, lesson, or roadmap version no longer exists.";
  }
  return fallback;
}

async function requireDraftVersion(admin: AdminClient, versionId: string) {
  if (!versionId) throw new Error("Missing roadmap version.");

  const { data: version, error } = await admin
    .from("roadmap_versions")
    .select("id, status, track_id")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !version) throw new Error("Roadmap version not found.");
  if (version.status !== "draft") {
    throw new Error("Only draft roadmap versions can be edited.");
  }

  const { data: track, error: trackError } = await admin
    .from("learning_tracks")
    .select("slug")
    .eq("id", version.track_id)
    .maybeSingle();

  if (trackError || track?.slug !== "full-stack-development") {
    throw new Error("This content manager only supports the Full-Stack Development track.");
  }

  return version;
}

async function requireTopicInDraft(
  admin: AdminClient,
  topicId: string,
  versionId: string,
) {
  const { data: topic, error } = await admin
    .from("roadmap_topics")
    .select("id, roadmap_version_id, title, is_active")
    .eq("id", topicId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !topic) throw new Error("Topic not found in this draft version.");
  if (!topic.is_active) throw new Error("This topic is archived and cannot be changed.");
  return topic;
}

async function requireLessonInDraft(
  admin: AdminClient,
  lessonId: string,
  topicId: string,
  versionId: string,
) {
  const { data: lesson, error } = await admin
    .from("learning_lessons")
    .select("id, roadmap_topic_id, roadmap_version_id, title, is_active")
    .eq("id", lessonId)
    .eq("roadmap_topic_id", topicId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !lesson) throw new Error("Lesson not found in this topic and draft version.");
  if (!lesson.is_active) throw new Error("This lesson is archived and cannot be changed.");
  return lesson;
}

async function requireResourceInDraft(
  admin: AdminClient,
  resourceId: string,
  lessonId: string,
  versionId: string,
) {
  const { data: resource, error } = await admin
    .from("learning_resources")
    .select("id, is_active")
    .eq("id", resourceId)
    .eq("lesson_id", lessonId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !resource) throw new Error("Resource not found in this lesson and draft version.");
  if (!resource.is_active) throw new Error("This resource is archived and cannot be changed.");
  return resource;
}

async function performAction(
  path: string,
  fallback: string,
  action: () => Promise<void>,
  successMessage: string,
) {
  try {
    await action();
  } catch (error) {
    redirectWithFeedback(
      path,
      "error",
      error instanceof Error ? error.message : fallback,
    );
  }

  revalidatePath(path);
  revalidatePath("/admin/roadmap");
  redirectWithFeedback(path, "success", successMessage);
}

export async function createLessonAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const topicId = getText(formData, "topicId");
  const path = `/admin/roadmap/topics/${topicId}`;

  await performAction(path, "Couldn't create the lesson.", async () => {
    await requireDraftVersion(admin, versionId);
    await requireTopicInDraft(admin, topicId, versionId);

    const lessonKey = getText(formData, "lessonKey").toLowerCase();
    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const objectives = getLines(formData, "objectives");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);
    const isRequired = getChecked(formData, "isRequired");

    validateKey(lessonKey, "Lesson key");
    if (!title) throw new Error("Lesson title is required.");

    const { error } = await admin.from("learning_lessons").insert({
      roadmap_version_id: versionId,
      roadmap_topic_id: topicId,
      lesson_key: lessonKey,
      title,
      description,
      objectives,
      sort_order: sortOrder,
      is_required: isRequired,
      is_active: true,
    });

    if (error) {
      throw new Error(getFriendlyDatabaseError(error, "Couldn't create the lesson."));
    }
  }, "Lesson created successfully.");
}

export async function updateLessonAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const topicId = getText(formData, "topicId");
  const lessonId = getText(formData, "lessonId");
  const path = `/admin/roadmap/topics/${topicId}`;

  await performAction(path, "Couldn't update the lesson.", async () => {
    await requireDraftVersion(admin, versionId);
    await requireTopicInDraft(admin, topicId, versionId);
    await requireLessonInDraft(admin, lessonId, topicId, versionId);

    const lessonKey = getText(formData, "lessonKey").toLowerCase();
    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const objectives = getLines(formData, "objectives");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);
    const isRequired = getChecked(formData, "isRequired");

    validateKey(lessonKey, "Lesson key");
    if (!title) throw new Error("Lesson title is required.");

    const { error } = await admin
      .from("learning_lessons")
      .update({
        lesson_key: lessonKey,
        title,
        description,
        objectives,
        sort_order: sortOrder,
        is_required: isRequired,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lessonId)
      .eq("roadmap_topic_id", topicId)
      .eq("roadmap_version_id", versionId);

    if (error) {
      throw new Error(getFriendlyDatabaseError(error, "Couldn't update the lesson."));
    }
  }, "Lesson updated successfully.");
}

export async function archiveLessonAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const topicId = getText(formData, "topicId");
  const lessonId = getText(formData, "lessonId");
  const path = `/admin/roadmap/topics/${topicId}`;

  await performAction(path, "Couldn't archive the lesson.", async () => {
    await requireDraftVersion(admin, versionId);
    await requireTopicInDraft(admin, topicId, versionId);
    await requireLessonInDraft(admin, lessonId, topicId, versionId);

    const { error } = await admin.rpc("archive_roadmap_lesson_with_resources", {
      p_version_id: versionId,
      p_topic_id: topicId,
      p_lesson_id: lessonId,
    });

    if (error) {
      throw new Error(getFriendlyDatabaseError(error, "Couldn't archive the lesson and its resources."));
    }
  }, "Lesson archived successfully.");
}

export async function createResourceAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const topicId = getText(formData, "topicId");
  const lessonId = getText(formData, "lessonId");
  const path = `/admin/roadmap/topics/${topicId}`;

  await performAction(path, "Couldn't create the resource.", async () => {
    await requireDraftVersion(admin, versionId);
    await requireTopicInDraft(admin, topicId, versionId);
    await requireLessonInDraft(admin, lessonId, topicId, versionId);

    const resourceKey = getText(formData, "resourceKey").toLowerCase();
    const title = getText(formData, "title");
    const resourceType = getResourceType(getText(formData, "resourceType"));
    const url = getText(formData, "url");
    const provider = getText(formData, "provider");
    const description = getText(formData, "description");
    const language = getResourceLanguage(getText(formData, "language"));
    const durationSeconds = getOptionalNonNegativeInteger(formData, "durationSeconds");
    const isRequired = getChecked(formData, "isRequired");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    validateKey(resourceKey, "Resource key");
    if (!title) throw new Error("Resource title is required.");
    validateHttpUrl(url);

    const { error } = await admin.from("learning_resources").insert({
      roadmap_version_id: versionId,
      lesson_id: lessonId,
      resource_key: resourceKey,
      title,
      resource_type: resourceType,
      url,
      provider,
      description,
      language,
      duration_seconds: durationSeconds,
      is_required: isRequired,
      sort_order: sortOrder,
      is_active: true,
    });

    if (error) {
      throw new Error(getFriendlyDatabaseError(error, "Couldn't create the resource."));
    }
  }, "Resource created successfully.");
}

export async function updateResourceAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const topicId = getText(formData, "topicId");
  const lessonId = getText(formData, "lessonId");
  const resourceId = getText(formData, "resourceId");
  const path = `/admin/roadmap/topics/${topicId}`;

  await performAction(path, "Couldn't update the resource.", async () => {
    await requireDraftVersion(admin, versionId);
    await requireTopicInDraft(admin, topicId, versionId);
    await requireLessonInDraft(admin, lessonId, topicId, versionId);
    await requireResourceInDraft(admin, resourceId, lessonId, versionId);

    const resourceKey = getText(formData, "resourceKey").toLowerCase();
    const title = getText(formData, "title");
    const resourceType = getResourceType(getText(formData, "resourceType"));
    const url = getText(formData, "url");
    const provider = getText(formData, "provider");
    const description = getText(formData, "description");
    const language = getResourceLanguage(getText(formData, "language"));
    const durationSeconds = getOptionalNonNegativeInteger(formData, "durationSeconds");
    const isRequired = getChecked(formData, "isRequired");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    validateKey(resourceKey, "Resource key");
    if (!title) throw new Error("Resource title is required.");
    validateHttpUrl(url);

    const { error } = await admin
      .from("learning_resources")
      .update({
        resource_key: resourceKey,
        title,
        resource_type: resourceType,
        url,
        provider,
        description,
        language,
        duration_seconds: durationSeconds,
        is_required: isRequired,
        sort_order: sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resourceId)
      .eq("lesson_id", lessonId)
      .eq("roadmap_version_id", versionId);

    if (error) {
      throw new Error(getFriendlyDatabaseError(error, "Couldn't update the resource."));
    }
  }, "Resource updated successfully.");
}

export async function archiveResourceAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const topicId = getText(formData, "topicId");
  const lessonId = getText(formData, "lessonId");
  const resourceId = getText(formData, "resourceId");
  const path = `/admin/roadmap/topics/${topicId}`;

  await performAction(path, "Couldn't archive the resource.", async () => {
    await requireDraftVersion(admin, versionId);
    await requireTopicInDraft(admin, topicId, versionId);
    await requireLessonInDraft(admin, lessonId, topicId, versionId);
    await requireResourceInDraft(admin, resourceId, lessonId, versionId);

    const { error } = await admin
      .from("learning_resources")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", resourceId)
      .eq("lesson_id", lessonId)
      .eq("roadmap_version_id", versionId);

    if (error) {
      throw new Error(getFriendlyDatabaseError(error, "Couldn't archive the resource."));
    }
  }, "Resource archived successfully.");
}
