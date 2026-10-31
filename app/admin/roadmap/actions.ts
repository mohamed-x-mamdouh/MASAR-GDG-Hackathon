"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

function redirectWithFeedback(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`${path}?${params.toString()}`);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
  const value = raw === null || String(raw).trim() === "" ? fallback : Number(raw);

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`${key} must be between 0 and 100.`);
  }

  return value;
}

async function requireDraftVersion(
  admin: ReturnType<typeof createAdminClient>,
  versionId: string,
) {
  if (!versionId) {
    throw new Error("Missing roadmap version.");
  }

  const { data: version, error } = await admin
    .from("roadmap_versions")
    .select("id, track_id, status")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !version) {
    console.error("Failed to read roadmap version:", error);
    throw new Error("Roadmap version not found.");
  }

  if (version.status !== "draft") {
    throw new Error("Only draft roadmap versions can be edited.");
  }

  return version;
}

async function getModuleForDraft(
  admin: ReturnType<typeof createAdminClient>,
  moduleId: string,
  versionId: string,
) {
  const { data: roadmapModule, error } = await admin
    .from("roadmap_modules")
    .select("id, module_key, roadmap_version_id")
    .eq("id", moduleId)
    .eq("roadmap_version_id", versionId)
    .maybeSingle();

  if (error || !roadmapModule) {
    console.error("Failed to find module in draft:", error);
    throw new Error("Module not found in this roadmap version.");
  }

  return roadmapModule;
}

function hasPath(
  graph: Map<string, string[]>,
  start: string,
  target: string,
  visited = new Set<string>(),
): boolean {
  if (start === target) return true;
  if (visited.has(start)) return false;

  visited.add(start);

  for (const next of graph.get(start) ?? []) {
    if (hasPath(graph, next, target, visited)) {
      return true;
    }
  }

  return false;
}

function parsePrerequisiteIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("prerequisiteModuleIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];
}

async function validatePrerequisites(
  admin: ReturnType<typeof createAdminClient>,
  versionId: string,
  moduleId: string,
  prerequisiteIds: string[],
) {
  if (prerequisiteIds.includes(moduleId)) {
    throw new Error("A module cannot be its own prerequisite.");
  }

  if (prerequisiteIds.length > 0) {
    const { data: modules, error } = await admin
      .from("roadmap_modules")
      .select("id")
      .eq("roadmap_version_id", versionId)
      .in("id", prerequisiteIds);

    if (error || modules?.length !== prerequisiteIds.length) {
      console.error("Failed to validate prerequisite modules:", error);
      throw new Error(
        "One or more prerequisites do not belong to this roadmap version.",
      );
    }
  }

  const { data: existingEdges, error: edgesError } = await admin
    .from("roadmap_module_prerequisites")
    .select("roadmap_module_id, prerequisite_module_id")
    .eq("roadmap_version_id", versionId)
    .neq("roadmap_module_id", moduleId);

  if (edgesError) {
    console.error("Failed to read existing prerequisite edges:", edgesError);
    throw new Error("Couldn't validate module prerequisites.");
  }

  const graph = new Map<string, string[]>();

  for (const edge of existingEdges ?? []) {
    const current = graph.get(edge.roadmap_module_id) ?? [];
    current.push(edge.prerequisite_module_id);
    graph.set(edge.roadmap_module_id, current);
  }

  graph.set(moduleId, prerequisiteIds);

  for (const prerequisiteId of prerequisiteIds) {
    if (hasPath(graph, prerequisiteId, moduleId)) {
      throw new Error(
        "These prerequisites would create a circular dependency.",
      );
    }
  }
}

export async function createRoadmapModuleAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    await requireDraftVersion(admin, versionId);

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
      throw new Error("Module key must be URL-safe, such as react-basics.");
    }

    if (!title) {
      throw new Error("Module title is required.");
    }

    if (prerequisiteIds.length > 0) {
      const { data: prerequisites, error: prerequisiteLookupError } = await admin
        .from("roadmap_modules")
        .select("id")
        .eq("roadmap_version_id", versionId)
        .in("id", prerequisiteIds);

      if (
        prerequisiteLookupError ||
        prerequisites?.length !== prerequisiteIds.length
      ) {
        console.error(
          "Failed to validate new module prerequisites:",
          prerequisiteLookupError,
        );
        throw new Error("Choose valid prerequisite modules.");
      }
    }

    const { data: createdModule, error: moduleError } = await admin
      .from("roadmap_modules")
      .insert({
        roadmap_version_id: versionId,
        module_key: moduleKey,
        sort_order: sortOrder,
        title,
        description,
        estimated_duration: duration,
        skills,
        objectives,
        completion_criteria: completionCriteria,
      })
      .select("id")
      .single();

    if (moduleError || !createdModule) {
      console.error("Failed to create roadmap module:", moduleError);

      if (moduleError?.code === "23505") {
        throw new Error(
          "This module key or sort order is already used in this version.",
        );
      }

      throw new Error("Couldn't create the module. Check its details.");
    }

    if (prerequisiteIds.length > 0) {
      const rows = prerequisiteIds.map((prerequisiteId) => ({
        roadmap_version_id: versionId,
        roadmap_module_id: createdModule.id,
        prerequisite_module_id: prerequisiteId,
      }));

      const { error: prerequisiteInsertError } = await admin
        .from("roadmap_module_prerequisites")
        .insert(rows);

      if (prerequisiteInsertError) {
        const { error: rollbackError } = await admin
          .from("roadmap_modules")
          .delete()
          .eq("id", createdModule.id);

        if (rollbackError) {
          console.error("Failed to roll back new module:", rollbackError);
        }

        console.error(
          "Failed to save module prerequisites:",
          prerequisiteInsertError,
        );
        throw new Error("Couldn't save the module prerequisites.");
      }
    }
  } catch (error) {
    console.error("createRoadmapModuleAction failed:", error);
    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getErrorMessage(error, "Something went wrong while creating the module."),
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

    await requireDraftVersion(admin, versionId);
    await getModuleForDraft(admin, moduleId, versionId);

    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);

    if (!title) {
      throw new Error("Module title is required.");
    }

    const skills = getLines(formData, "skills");
    const objectives = getLines(formData, "objectives");
    const completionCriteria = getLines(formData, "completionCriteria");
    const prerequisiteIds = parsePrerequisiteIds(formData);

    await validatePrerequisites(
      admin,
      versionId,
      moduleId,
      prerequisiteIds,
    );

    const { error: updateError } = await admin
      .from("roadmap_modules")
      .update({
        title,
        description,
        estimated_duration: duration,
        sort_order: sortOrder,
        skills,
        objectives,
        completion_criteria: completionCriteria,
        updated_at: new Date().toISOString(),
      })
      .eq("id", moduleId)
      .eq("roadmap_version_id", versionId);

    if (updateError) {
      console.error("Failed to update roadmap module:", updateError);
      if (updateError.code === "23505") {
        throw new Error("This module sort order is already used in this version.");
      }
      throw new Error("Couldn't update the module. Check its details.");
    }

    const { data: previousEdges, error: readEdgesError } = await admin
      .from("roadmap_module_prerequisites")
      .select("prerequisite_module_id")
      .eq("roadmap_version_id", versionId)
      .eq("roadmap_module_id", moduleId);

    if (readEdgesError) {
      console.error("Failed to read previous prerequisites:", readEdgesError);
      throw new Error("Module details were saved, but prerequisites couldn't be read.");
    }

    const { error: deleteError } = await admin
      .from("roadmap_module_prerequisites")
      .delete()
      .eq("roadmap_version_id", versionId)
      .eq("roadmap_module_id", moduleId);

    if (deleteError) {
      console.error("Failed to clear old prerequisites:", deleteError);
      throw new Error("Module details were saved, but prerequisites couldn't be updated.");
    }

    if (prerequisiteIds.length > 0) {
      const rows = prerequisiteIds.map((prerequisiteId) => ({
        roadmap_version_id: versionId,
        roadmap_module_id: moduleId,
        prerequisite_module_id: prerequisiteId,
      }));

      const { error: insertError } = await admin
        .from("roadmap_module_prerequisites")
        .insert(rows);

      if (insertError) {
        const restoreRows = (previousEdges ?? []).map((edge) => ({
          roadmap_version_id: versionId,
          roadmap_module_id: moduleId,
          prerequisite_module_id: edge.prerequisite_module_id,
        }));

        if (restoreRows.length > 0) {
          const { error: restoreError } = await admin
            .from("roadmap_module_prerequisites")
            .insert(restoreRows);

          if (restoreError) {
            console.error("Failed to restore previous prerequisites:", restoreError);
          }
        }

        console.error("Failed to save new prerequisites:", insertError);
        throw new Error("Couldn't save the new prerequisites. Previous prerequisites were restored when possible.");
      }
    }
  } catch (error) {
    console.error("updateRoadmapModuleAction failed:", error);
    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getErrorMessage(error, "Something went wrong while updating the module."),
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

export async function createRoadmapTopicAction(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  try {
    const versionId = getText(formData, "versionId");
    const moduleId = getText(formData, "moduleId");

    await requireDraftVersion(admin, versionId);
    const roadmapModule = await getModuleForDraft(admin, moduleId, versionId);

    const slug = getText(formData, "slug").toLowerCase();
    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);
    const passPercentage = getPercentage(formData, "passPercentage", 70);
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

    const topicKey = `${roadmapModule.module_key}:${slug}`;
    const { error: topicError } = await admin
      .from("roadmap_topics")
      .insert({
        roadmap_version_id: versionId,
        roadmap_module_id: moduleId,
        legacy_topic_id: null,
        topic_key: topicKey,
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

    if (topicError) {
      console.error("Failed to create roadmap topic:", topicError);

      if (topicError.code === "23505") {
        throw new Error(
          "A topic with this slug or sort order already exists in this module.",
        );
      }

      throw new Error("Couldn't create the topic. Check the server logs for details.");
    }
  } catch (error) {
    console.error("createRoadmapTopicAction failed:", error);
    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getErrorMessage(error, "Something went wrong while creating the topic."),
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

    await requireDraftVersion(admin, versionId);

    const { data: topic, error: topicError } = await admin
      .from("roadmap_topics")
      .select("id")
      .eq("id", topicId)
      .eq("roadmap_version_id", versionId)
      .maybeSingle();

    if (topicError || !topic) {
      console.error("Failed to find roadmap topic:", topicError);
      throw new Error("Topic not found in this roadmap version.");
    }

    const title = getText(formData, "title");
    const description = getText(formData, "description");
    const duration = getText(formData, "estimatedDuration");
    const sortOrder = getPositiveInteger(formData, "sortOrder", 1);
    const passPercentage = getPercentage(formData, "passPercentage", 70);
    const questionsPerAttempt = getPositiveInteger(
      formData,
      "questionsPerAttempt",
      5,
    );
    const objectives = getLines(formData, "objectives");

    if (!title) {
      throw new Error("Topic title is required.");
    }

    const { error: updateError } = await admin
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
      .eq("roadmap_version_id", versionId);

    if (updateError) {
      console.error("Failed to update roadmap topic:", updateError);

      if (updateError.code === "23505") {
        throw new Error("This topic sort order is already used in this module.");
      }

      throw new Error("Couldn't update this topic.");
    }
  } catch (error) {
    console.error("updateRoadmapTopicAction failed:", error);
    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getErrorMessage(error, "Something went wrong while updating the topic."),
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

    await requireDraftVersion(admin, versionId);

    const { data: topic, error: topicError } = await admin
      .from("roadmap_topics")
      .select("id")
      .eq("id", topicId)
      .eq("roadmap_version_id", versionId)
      .maybeSingle();

    if (topicError || !topic) {
      console.error("Failed to find topic to archive:", topicError);
      throw new Error("Topic not found in this roadmap version.");
    }

    const { error: archiveError } = await admin
      .from("roadmap_topics")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topicId)
      .eq("roadmap_version_id", versionId);

    if (archiveError) {
      console.error("Failed to archive roadmap topic:", archiveError);
      throw new Error("Couldn't archive this topic.");
    }
  } catch (error) {
    console.error("archiveRoadmapTopicAction failed:", error);
    redirectWithFeedback(
      "/admin/roadmap",
      "error",
      getErrorMessage(error, "Something went wrong while archiving the topic."),
    );
  }

  revalidatePath("/admin/roadmap");
  revalidatePath("/roadmap");
  redirectWithFeedback(
    "/admin/roadmap",
    "success",
    "Topic archived successfully.",
  );
}
