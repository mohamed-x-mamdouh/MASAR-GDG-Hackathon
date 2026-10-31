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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.role !== "admin") redirect("/dashboard");
}

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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
    throw new Error(`${key} must be zero or a positive integer.`);
  }
  return value;
}

function getChecked(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function validateKey(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Resource key must be URL-safe, e.g. javascript-overview.");
  }
}

function validateUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS URLs are allowed.");
    }
  } catch {
    throw new Error("Enter a valid URL beginning with https:// or http://.");
  }
}

function getResourceType(value: string): ResourceType {
  if (!RESOURCE_TYPES.includes(value as ResourceType)) {
    throw new Error("Choose a valid resource type.");
  }
  return value as ResourceType;
}

function getLanguage(value: string): ResourceLanguage {
  if (!RESOURCE_LANGUAGES.includes(value as ResourceLanguage)) {
    throw new Error("Choose a valid resource language.");
  }
  return value as ResourceLanguage;
}

function redirectWithFeedback(path: string, kind: "success" | "error", message: string): never {
  const query = new URLSearchParams({ [kind]: message });
  redirect(`${path}?${query.toString()}`);
}

function friendlyError(error: { code?: string; message?: string }, fallback: string) {
  console.error(fallback, error);
  if (error.code === "23505") return "This resource key or order is already used in this module.";
  if (error.code === "23514") return "A field value is not allowed by the database.";
  if (error.code === "23503") return "The selected module or roadmap version no longer exists.";
  return fallback;
}

async function requireDraftFullStackVersion(admin: AdminClient, versionId: string) {
  if (!versionId) throw new Error("Missing roadmap version.");

  const { data: version, error } = await admin
    .from("roadmap_versions")
    .select("id, status, track_id")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !version) throw new Error("Roadmap version not found.");
  if (version.status !== "draft") throw new Error("Only draft roadmap versions can be edited.");

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

async function requireActiveModule(admin: AdminClient, moduleId: string, versionId: string) {
  const { data: module, error } = await admin
    .from("roadmap_modules")
    .select("id, title, is_active")
    .eq("id", moduleId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !module) throw new Error("Module not found in this roadmap version.");
  if (!module.is_active) throw new Error("This module is archived and cannot be changed.");
  return module;
}

async function requireActiveModuleResource(
  admin: AdminClient,
  resourceId: string,
  moduleId: string,
  versionId: string,
) {
  const { data: resource, error } = await admin
    .from("roadmap_module_resources")
    .select("id, is_active")
    .eq("id", resourceId)
    .eq("roadmap_module_id", moduleId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !resource) throw new Error("Module resource not found.");
  if (!resource.is_active) throw new Error("This resource is archived and cannot be changed.");
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

export async function createModuleResourceAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const moduleId = getText(formData, "moduleId");
  const path = `/admin/roadmap/modules/${moduleId}`;

  await performAction(path, "Couldn't create the module resource.", async () => {
    await requireDraftFullStackVersion(admin, versionId);
    await requireActiveModule(admin, moduleId, versionId);

    const resourceKey = getText(formData, "resourceKey").toLowerCase();
    const title = getText(formData, "title");
    const resourceType = getResourceType(getText(formData, "resourceType"));
    const url = getText(formData, "url");
    const provider = getText(formData, "provider");
    const description = getText(formData, "description");
    const language = getLanguage(getText(formData, "language"));
    const durationSeconds = getOptionalNonNegativeInteger(formData, "durationSeconds");
    const isRequired = getChecked(formData, "isRequired");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    validateKey(resourceKey);
    if (!title) throw new Error("Resource title is required.");
    validateUrl(url);

    const { error } = await admin.from("roadmap_module_resources").insert({
      roadmap_version_id: versionId,
      roadmap_module_id: moduleId,
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

    if (error) throw new Error(friendlyError(error, "Couldn't create the module resource."));
  }, "Module resource created successfully.");
}

export async function updateModuleResourceAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const moduleId = getText(formData, "moduleId");
  const resourceId = getText(formData, "resourceId");
  const path = `/admin/roadmap/modules/${moduleId}`;

  await performAction(path, "Couldn't update the module resource.", async () => {
    await requireDraftFullStackVersion(admin, versionId);
    await requireActiveModule(admin, moduleId, versionId);
    await requireActiveModuleResource(admin, resourceId, moduleId, versionId);

    const resourceKey = getText(formData, "resourceKey").toLowerCase();
    const title = getText(formData, "title");
    const resourceType = getResourceType(getText(formData, "resourceType"));
    const url = getText(formData, "url");
    const provider = getText(formData, "provider");
    const description = getText(formData, "description");
    const language = getLanguage(getText(formData, "language"));
    const durationSeconds = getOptionalNonNegativeInteger(formData, "durationSeconds");
    const isRequired = getChecked(formData, "isRequired");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    validateKey(resourceKey);
    if (!title) throw new Error("Resource title is required.");
    validateUrl(url);

    const { error } = await admin
      .from("roadmap_module_resources")
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
      .eq("roadmap_module_id", moduleId)
      .eq("roadmap_version_id", versionId);

    if (error) throw new Error(friendlyError(error, "Couldn't update the module resource."));
  }, "Module resource updated successfully.");
}

export async function archiveModuleResourceAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();
  const versionId = getText(formData, "versionId");
  const moduleId = getText(formData, "moduleId");
  const resourceId = getText(formData, "resourceId");
  const path = `/admin/roadmap/modules/${moduleId}`;

  await performAction(path, "Couldn't archive the module resource.", async () => {
    await requireDraftFullStackVersion(admin, versionId);
    await requireActiveModule(admin, moduleId, versionId);
    await requireActiveModuleResource(admin, resourceId, moduleId, versionId);

    const { error } = await admin
      .from("roadmap_module_resources")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", resourceId)
      .eq("roadmap_module_id", moduleId)
      .eq("roadmap_version_id", versionId);

    if (error) throw new Error(friendlyError(error, "Couldn't archive the module resource."));
  }, "Module resource archived successfully.");
}
