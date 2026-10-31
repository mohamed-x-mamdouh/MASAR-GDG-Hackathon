"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const FULL_STACK_TRACK_SLUG = "full-stack-development";
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

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

function getLines(formData: FormData, key: string) {
  return getText(formData, key)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPositiveInteger(
  formData: FormData,
  key: string,
  fallback: number,
) {
  const raw = formData.get(key);

  if (raw === null || String(raw).trim() === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return value;
}

function getPercentage(
  formData: FormData,
  key: string,
  fallback: number,
) {
  const raw = formData.get(key);

  const value =
    raw === null || String(raw).trim() === ""
      ? fallback
      : Number(raw);

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`${key} must be between 0 and 100.`);
  }

  return value;
}

function requireUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
}

function redirectWithFeedback(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({
    [type]: message,
  });

  redirect(`${path}?${params.toString()}`);
}

function getActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const databaseError = error as {
      code?: string;
      message?: string;
    };

    if (databaseError.code === "23505") {
      return "This key or sort order is already used in this parent item.";
    }

    if (databaseError.code === "23503") {
      return "A selected item no longer exists in this roadmap version.";
    }

    if (databaseError.code === "23514") {
      return "One of the submitted values is not allowed.";
    }

    if (databaseError.message) {
      return databaseError.message;
    }
  }

  return fallback;
}

async function requireDraftFullStackVersion(
  admin: AdminClient,
  versionId: string,
) {
  requireUuid(versionId, "Roadmap version ID");

  const { data: version, error } = await admin
    .from("roadmap_versions")
    .select("id, track_id, status")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !version) {
    console.error("Failed to load roadmap version:", error);
    throw new Error("Roadmap version not found.");
  }

  if (version.status !== "draft") {
    throw new Error("Only draft roadmap versions can be edited.");
  }

  const { data: track, error: trackError } = await admin
    .from("learning_tracks")
    .select("slug")
    .eq("id", version.track_id)
    .maybeSingle();

  if (trackError || track?.slug !== FULL_STACK_TRACK_SLUG) {
    throw new Error(
      "This admin builder only supports the Full-Stack Development track.",
    );
  }

  return version;
}

async function requireActiveModule(
  admin: AdminClient,
  moduleId: string,
  versionId: string,
) {
  requireUuid(moduleId, "Module ID");

  const { data: roadmapModule, error } = await admin
    .from("roadmap_modules")
    .select("id, module_key, roadmap_version_id, is_active")
    .eq("id", moduleId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !roadmapModule) {
    console.error("Failed to find module in roadmap version:", error);
    throw new Error("Module not found in this roadmap version.");
  }

  if (!roadmapModule.is_active) {
    throw new Error("This module is archived and cannot be changed.");
  }

  return roadmapModule;
}

function parsePrerequisiteIds(formData: FormData) {
  const ids = [
    ...new Set(
      formData
        .getAll("prerequisiteModuleIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];

  ids.forEach((id) => requireUuid(id, "Prerequisite module ID"));

  return ids;
}

// ======================================================
// MODULE ACTIONS
// ======================================================

export async function createRoadmapModuleAction(formData: FormData) {
  await requireAdmin();

  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");

    await requireDraftFullStackVersion(admin, versionId);

    const moduleKey = getText(formData, "moduleKey").toLowerCase();
    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    const skills = getLines(formData, "skills");
    const objectives = getLines(formData, "objectives");
    const completionCriteria = getLines(formData, "completionCriteria");

    const prerequisiteIds = parsePrerequisiteIds(formData);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(moduleKey)) {
      throw new Error(
        "Module key must be URL-safe, such as react-basics.",
      );
    }

    if (!title) {
      throw new Error("Module title is required.");
    }

    const { error } = await admin.rpc(
      "create_roadmap_module_with_prerequisites",
      {
        p_version_id: versionId,
        p_module_key: moduleKey,
        p_title: title,
        p_description: description,
        p_estimated_duration: duration,
        p_sort_order: sortOrder,
        p_skills: skills,
        p_objectives: objectives,
        p_completion_criteria: completionCriteria,
        p_prerequisite_ids: prerequisiteIds,
      },
    );

    if (error) {
      console.error(
        "Failed to create roadmap module atomically:",
        error,
      );

      throw new Error(
        getActionError(error, "Couldn't create the module."),
      );
    }
  } catch (error) {
    console.error("createRoadmapModuleAction failed:", error);

    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getActionError(
        error,
        "Something went wrong while creating the module.",
      ),
    );
  }

  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");

  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Module created successfully.",
  );
}

export async function updateRoadmapModuleAction(formData: FormData) {
  await requireAdmin();

  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    const moduleId = getText(formData, "moduleId");

    await requireDraftFullStackVersion(admin, versionId);
    await requireActiveModule(admin, moduleId, versionId);

    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    const skills = getLines(formData, "skills");
    const objectives = getLines(formData, "objectives");
    const completionCriteria = getLines(formData, "completionCriteria");

    const prerequisiteIds = parsePrerequisiteIds(formData);

    if (!title) {
      throw new Error("Module title is required.");
    }

    const { error } = await admin.rpc(
      "update_roadmap_module_with_prerequisites",
      {
        p_version_id: versionId,
        p_module_id: moduleId,
        p_title: title,
        p_description: description,
        p_estimated_duration: duration,
        p_sort_order: sortOrder,
        p_skills: skills,
        p_objectives: objectives,
        p_completion_criteria: completionCriteria,
        p_prerequisite_ids: prerequisiteIds,
      },
    );

    if (error) {
      console.error(
        "Failed to update roadmap module atomically:",
        error,
      );

      throw new Error(
        getActionError(error, "Couldn't update the module."),
      );
    }
  } catch (error) {
    console.error("updateRoadmapModuleAction failed:", error);

    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getActionError(
        error,
        "Something went wrong while updating the module.",
      ),
    );
  }

  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");

  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Module updated successfully.",
  );
}

export async function archiveRoadmapModuleAction(formData: FormData) {
  await requireAdmin();

  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    const moduleId = getText(formData, "moduleId");

    await requireDraftFullStackVersion(admin, versionId);
    requireUuid(moduleId, "Module ID");

    const { error } = await admin.rpc("archive_roadmap_module", {
      p_version_id: versionId,
      p_module_id: moduleId,
    });

    if (error) {
      console.error("Failed to archive roadmap module:", error);

      throw new Error(
        getActionError(error, "Couldn't archive this module."),
      );
    }
  } catch (error) {
    console.error("archiveRoadmapModuleAction failed:", error);

    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getActionError(
        error,
        "Something went wrong while archiving the module.",
      ),
    );
  }

  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");

  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Module and all its learning content were archived successfully.",
  );
}

// ======================================================
// TOPIC ACTIONS
// ======================================================

export async function createRoadmapTopicAction(formData: FormData) {
  await requireAdmin();

  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    const moduleId = getText(formData, "moduleId");

    await requireDraftFullStackVersion(admin, versionId);

    const roadmapModule = await requireActiveModule(
      admin,
      moduleId,
      versionId,
    );

    const slug = getText(formData, "slug").toLowerCase();
    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    const passPercentage = getPercentage(
      formData,
      "passPercentage",
      70,
    );

    const questionsPerAttempt = getPositiveInteger(
      formData,
      "questionsPerAttempt",
      5,
    );

    const objectives = getLines(formData, "objectives");

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Topic slug must be URL-safe.");
    }

    if (!title) {
      throw new Error("Topic title is required.");
    }

    const { error } = await admin
      .from("roadmap_topics")
      .insert({
        roadmap_version_id: versionId,
        roadmap_module_id: moduleId,
        legacy_topic_id: null,
        topic_key: `${roadmapModule.module_key}:${slug}`,
        slug,
        title,
        description,
        sort_order: sortOrder,
        objectives,
        estimated_duration: duration,
        pass_percentage: passPercentage,
        questions_per_attempt: questionsPerAttempt,
        is_active: true,
      });

    if (error) {
      console.error("Failed to create roadmap topic:", error);

      throw new Error(
        getActionError(error, "Couldn't create the topic."),
      );
    }
  } catch (error) {
    console.error("createRoadmapTopicAction failed:", error);

    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getActionError(
        error,
        "Something went wrong while creating the topic.",
      ),
    );
  }

  revalidatePath("/admin/roadmap");

  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Topic created successfully.",
  );
}

export async function updateRoadmapTopicAction(formData: FormData) {
  await requireAdmin();

  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    const topicId = getText(formData, "topicId");

    await requireDraftFullStackVersion(admin, versionId);
    requireUuid(topicId, "Topic ID");

    const { data: topic, error: topicError } = await admin
      .from("roadmap_topics")
      .select("id, roadmap_module_id, is_active")
      .eq("id", topicId)
      .eq("roadmap_version_id", versionId)
      .maybeSingle();

    if (topicError || !topic) {
      console.error("Failed to find topic to update:", topicError);

      throw new Error(
        "Topic not found in this roadmap version.",
      );
    }

    if (!topic.is_active) {
      throw new Error("Archived topics cannot be edited.");
    }

    await requireActiveModule(
      admin,
      topic.roadmap_module_id,
      versionId,
    );

    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    const passPercentage = getPercentage(
      formData,
      "passPercentage",
      70,
    );

    const questionsPerAttempt = getPositiveInteger(
      formData,
      "questionsPerAttempt",
      5,
    );

    const objectives = getLines(formData, "objectives");

    if (!title) {
      throw new Error("Topic title is required.");
    }

    const { error } = await admin
      .from("roadmap_topics")
      .update({
        title,
        description,
        sort_order: sortOrder,
        objectives,
        estimated_duration: duration,
        pass_percentage: passPercentage,
        questions_per_attempt: questionsPerAttempt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId)
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true);

    if (error) {
      console.error("Failed to update roadmap topic:", error);

      throw new Error(
        getActionError(error, "Couldn't update this topic."),
      );
    }
  } catch (error) {
    console.error("updateRoadmapTopicAction failed:", error);

    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getActionError(
        error,
        "Something went wrong while updating the topic.",
      ),
    );
  }

  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");

  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Topic updated successfully.",
  );
}

export async function archiveRoadmapTopicAction(formData: FormData) {
  await requireAdmin();

  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    const topicId = getText(formData, "topicId");

    await requireDraftFullStackVersion(admin, versionId);
    requireUuid(topicId, "Topic ID");

    const { error } = await admin.rpc("archive_roadmap_topic", {
      p_version_id: versionId,
      p_topic_id: topicId,
    });

    if (error) {
      console.error(
        "Failed to archive roadmap topic atomically:",
        error,
      );

      throw new Error(
        getActionError(error, "Couldn't archive this topic."),
      );
    }
  } catch (error) {
    console.error("archiveRoadmapTopicAction failed:", error);

    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getActionError(
        error,
        "Something went wrong while archiving the topic.",
      ),
    );
  }

  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");

  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Topic and its lessons/resources were archived successfully.",
  );
}