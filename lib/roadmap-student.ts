import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type * from "./roadmap-student-types";
import type {
  StudentRoadmapModule,
  StudentModuleResource,
  StudentTopic,
  StudentLesson,
  StudentLessonResource,
  StudentModuleDetail,
  RoadmapOverviewData,
} from "./roadmap-student-types";

export { toggleLessonProgressAction } from "@/app/roadmap/actions";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Loads the latest published version for the specified track.
 */
export async function getPublishedRoadmapVersion(
  trackSlug = "full-stack-development",
) {
  const supabase = await createClient();

  const { data: track, error: trackError } = await supabase
    .from("learning_tracks")
    .select("id, slug, title, description")
    .eq("slug", trackSlug)
    .maybeSingle();

  if (trackError || !track) {
    return null;
  }

  const { data: version, error: versionError } = await supabase
    .from("roadmap_versions")
    .select("id, track_id, version_number, status, published_at")
    .eq("track_id", track.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError || !version) {
    return null;
  }

  return { ...version, track };
}

/**
 * Gets the student's pinned enrollment, or idempotently assigns the latest published version.
 */
export async function getOrCreateStudentEnrollment(
  userId: string,
  trackSlug = "full-stack-development",
) {
  if (!isValidUuid(userId)) {
    return null;
  }

  const admin = createAdminClient();

  const { data: track } = await admin
    .from("learning_tracks")
    .select("id")
    .eq("slug", trackSlug)
    .maybeSingle();

  if (!track) return null;

  // 1. Check for existing active enrollment (pinned version)
  const { data: existing, error: findError } = await admin
    .from("roadmap_enrollments")
    .select("id, user_id, track_id, roadmap_version_id, status")
    .eq("user_id", userId)
    .eq("track_id", track.id)
    .eq("status", "active")
    .maybeSingle();

  if (findError) {
    console.error("Error looking up student enrollment:", findError);
  }

  if (existing) {
    return existing;
  }

  // 2. Fetch latest published version
  const { data: publishedVersion } = await admin
    .from("roadmap_versions")
    .select("id, track_id")
    .eq("track_id", track.id)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!publishedVersion) {
    return null;
  }

  // 3. Create active enrollment pinned to the latest published version
  const { data: newEnrollment, error: insertError } = await admin
    .from("roadmap_enrollments")
    .insert({
      user_id: userId,
      track_id: track.id,
      roadmap_version_id: publishedVersion.id,
      status: "active",
    })
    .select("id, user_id, track_id, roadmap_version_id, status")
    .maybeSingle();

  if (insertError) {
    // If concurrent insert occurred, re-query
    const { data: retryExisting } = await admin
      .from("roadmap_enrollments")
      .select("id, user_id, track_id, roadmap_version_id, status")
      .eq("user_id", userId)
      .eq("track_id", track.id)
      .eq("status", "active")
      .maybeSingle();

    return retryExisting ?? null;
  }

  return newEnrollment;
}

/**
 * Loads roadmap overview for the student or an anonymous visitor.
 */
export async function getStudentRoadmapData(
  userId?: string,
): Promise<RoadmapOverviewData> {
  const supabase = await createClient();

  let versionId: string | null = null;
  let enrollmentId: string | null = null;
  let trackTitle = "Full-Stack Development";
  let trackDescription =
    "The complete journey from web fundamentals to building and deploying full-stack web applications.";
  let versionNumber: number | undefined;

  if (userId) {
    const enrollment = await getOrCreateStudentEnrollment(userId);
    if (enrollment) {
      versionId = enrollment.roadmap_version_id;
      enrollmentId = enrollment.id;
    }
  }

  if (!versionId) {
    const published = await getPublishedRoadmapVersion();
    if (published) {
      versionId = published.id;
      versionNumber = published.version_number;
      trackTitle = published.track.title;
      trackDescription = published.track.description;
    }
  }

  if (!versionId) {
    return {
      hasPublishedRoadmap: false,
      trackTitle,
      trackDescription,
      modules: [],
      completedCount: 0,
      overallProgress: 0,
    };
  }

  // Load modules, prerequisites, topics, and lessons for this version
  const [
    { data: rawModules },
    { data: rawPrereqs },
    { data: rawTopics },
    { data: rawLessons },
  ] = await Promise.all([
    supabase
      .from("roadmap_modules")
      .select(
        "id, module_key, sort_order, title, description, estimated_duration, skills, objectives, completion_criteria",
      )
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("roadmap_module_prerequisites")
      .select("roadmap_module_id, prerequisite_module_id")
      .eq("roadmap_version_id", versionId),

    supabase
      .from("roadmap_topics")
      .select("id, roadmap_module_id")
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true),

    supabase
      .from("learning_lessons")
      .select("id, roadmap_topic_id, is_required")
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true),
  ]);

  const modules = rawModules ?? [];
  const prereqs = rawPrereqs ?? [];
  const topics = rawTopics ?? [];
  const lessons = rawLessons ?? [];

  // Map topic to module
  const topicToModule = new Map<string, string>();
  for (const t of topics) {
    topicToModule.set(t.id, t.roadmap_module_id);
  }

  // Total lessons per module
  const moduleTotalLessons = new Map<string, number>();
  const moduleRequiredLessons = new Map<string, string[]>();
  for (const l of lessons) {
    const modId = topicToModule.get(l.roadmap_topic_id);
    if (modId) {
      moduleTotalLessons.set(modId, (moduleTotalLessons.get(modId) ?? 0) + 1);
      if (l.is_required) {
        const reqs = moduleRequiredLessons.get(modId) ?? [];
        reqs.push(l.id);
        moduleRequiredLessons.set(modId, reqs);
      }
    }
  }

  // Student progress
  const completedLessonIds = new Set<string>();
  const verifiedModuleIds = new Set<string>();

  if (userId && enrollmentId) {
    const [{ data: lessonProg }, { data: modProg }] = await Promise.all([
      supabase
        .from("student_lesson_progress")
        .select("lesson_id")
        .eq("enrollment_id", enrollmentId)
        .eq("user_id", userId),
      supabase
        .from("student_module_progress")
        .select("roadmap_module_id, status")
        .eq("enrollment_id", enrollmentId)
        .eq("user_id", userId),
    ]);

    for (const row of lessonProg ?? []) {
      completedLessonIds.add(row.lesson_id);
    }
    for (const row of modProg ?? []) {
      if (row.status === "completed" || row.status === "validated") {
        verifiedModuleIds.add(row.roadmap_module_id);
      }
    }
  }

  // Completed lessons per module
  const moduleCompletedLessons = new Map<string, number>();
  for (const l of lessons) {
    if (completedLessonIds.has(l.id)) {
      const modId = topicToModule.get(l.roadmap_topic_id);
      if (modId) {
        moduleCompletedLessons.set(
          modId,
          (moduleCompletedLessons.get(modId) ?? 0) + 1,
        );
      }
    }
  }

  // Prerequisites map
  const prereqsByModule = new Map<string, string[]>();
  for (const p of prereqs) {
    const list = prereqsByModule.get(p.roadmap_module_id) ?? [];
    list.push(p.prerequisite_module_id);
    prereqsByModule.set(p.roadmap_module_id, list);
  }

  // Helper to determine if a module is considered completed by coursework
  const isModuleComplete = (modId: string): boolean => {
    if (verifiedModuleIds.has(modId)) return true;
    const required = moduleRequiredLessons.get(modId);
    if (!required || required.length === 0) {
      // If no required lessons, check if total lessons exist and are complete
      const total = moduleTotalLessons.get(modId) ?? 0;
      return total > 0 && (moduleCompletedLessons.get(modId) ?? 0) === total;
    }
    return required.every((reqLessonId) =>
      completedLessonIds.has(reqLessonId),
    );
  };

  // Determine unlock status and module state
  let hasAssignedCurrent = false;
  let currentModuleId: string | undefined;

  const resultModules: StudentRoadmapModule[] = [];

  for (const mod of modules) {
    const modulePrereqs = prereqsByModule.get(mod.id) ?? [];
    const isUnlocked = modulePrereqs.every((pId) => isModuleComplete(pId));

    let status: "completed" | "current" | "locked" = "locked";

    if (!isUnlocked) {
      status = "locked";
    } else if (isModuleComplete(mod.id)) {
      status = "completed";
    } else if (!hasAssignedCurrent) {
      status = "current";
      hasAssignedCurrent = true;
      currentModuleId = mod.id;
    } else {
      // Unlocked but not active focus yet
      status = "current";
    }

    resultModules.push({
      id: mod.id,
      moduleKey: mod.module_key,
      sortOrder: mod.sort_order,
      title: mod.title,
      description: mod.description ?? "",
      estimatedDuration: mod.estimated_duration ?? "2-3 weeks",
      skills: Array.isArray(mod.skills) ? mod.skills : [],
      objectives: Array.isArray(mod.objectives) ? mod.objectives : [],
      completionCriteria: Array.isArray(mod.completion_criteria)
        ? mod.completion_criteria
        : [],
      status,
      prerequisites: modulePrereqs,
      totalLessons: moduleTotalLessons.get(mod.id) ?? 0,
      completedLessons: moduleCompletedLessons.get(mod.id) ?? 0,
    });
  }

  const completedCount = resultModules.filter(
    (m) => m.status === "completed",
  ).length;
  const overallProgress =
    resultModules.length > 0
      ? Math.round((completedCount / resultModules.length) * 100)
      : 0;

  return {
    hasPublishedRoadmap: true,
    trackTitle,
    trackDescription,
    versionNumber,
    modules: resultModules,
    completedCount,
    overallProgress,
    currentModuleId,
  };
}

/**
 * Loads dynamic module detail for a student.
 * Supports both UUID and module_key for the route parameter.
 */
export async function getStudentModuleDetailData(
  moduleKeyOrId: string,
  userId?: string,
): Promise<StudentModuleDetail | null> {
  const supabase = await createClient();

  let versionId: string | null = null;
  let enrollmentId: string | null = null;

  if (userId) {
    const enrollment = await getOrCreateStudentEnrollment(userId);
    if (enrollment) {
      versionId = enrollment.roadmap_version_id;
      enrollmentId = enrollment.id;
    }
  }

  if (!versionId) {
    const published = await getPublishedRoadmapVersion();
    if (published) {
      versionId = published.id;
    }
  }

  if (!versionId) return null;

  // Find module in this roadmap version
  let moduleQuery = supabase
    .from("roadmap_modules")
    .select(
      "id, module_key, sort_order, title, description, estimated_duration, skills, objectives, completion_criteria",
    )
    .eq("roadmap_version_id", versionId)
    .eq("is_active", true);

  if (isValidUuid(moduleKeyOrId)) {
    moduleQuery = moduleQuery.or(
      `id.eq.${moduleKeyOrId},module_key.eq.${moduleKeyOrId}`,
    );
  } else {
    moduleQuery = moduleQuery.eq("module_key", moduleKeyOrId);
  }

  const { data: targetModule, error: modError } =
    await moduleQuery.maybeSingle();

  if (modError || !targetModule) {
    return null;
  }

  // Load all active modules in the version to find prev/next and prerequisites
  const [
    { data: allModules },
    { data: allPrereqs },
    { data: moduleResourcesRaw },
    { data: topicsRaw },
    { data: lessonsRaw },
    { data: lessonResourcesRaw },
  ] = await Promise.all([
    supabase
      .from("roadmap_modules")
      .select("id, module_key, sort_order, title")
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("roadmap_module_prerequisites")
      .select("roadmap_module_id, prerequisite_module_id")
      .eq("roadmap_version_id", versionId),

    supabase
      .from("roadmap_module_resources")
      .select(
        "id, resource_key, title, resource_type, url, provider, description, language, duration_minutes, is_required, sort_order",
      )
      .eq("roadmap_module_id", targetModule.id)
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("roadmap_topics")
      .select(
        "id, topic_key, slug, title, description, sort_order, objectives, estimated_duration",
      )
      .eq("roadmap_module_id", targetModule.id)
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("learning_lessons")
      .select(
        "id, roadmap_topic_id, lesson_key, title, description, objectives, sort_order, is_required",
      )
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("learning_resources")
      .select(
        "id, lesson_id, resource_key, title, resource_type, url, provider, description, language, duration_minutes, is_required, sort_order",
      )
      .eq("roadmap_version_id", versionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const moduleList = allModules ?? [];
  const currentIndex = moduleList.findIndex((m) => m.id === targetModule.id);
  const rawPrev = currentIndex > 0 ? moduleList[currentIndex - 1] : null;
  const previousModule = rawPrev
    ? { id: rawPrev.id, moduleKey: rawPrev.module_key, title: rawPrev.title }
    : null;
  const rawNext =
    currentIndex >= 0 && currentIndex < moduleList.length - 1
      ? moduleList[currentIndex + 1]
      : null;
  const nextModule = rawNext
    ? { id: rawNext.id, moduleKey: rawNext.module_key, title: rawNext.title }
    : null;

  // Prerequisites of target module
  const moduleMap = new Map(moduleList.map((m) => [m.id, m]));
  const targetPrereqIds = (allPrereqs ?? [])
    .filter((p) => p.roadmap_module_id === targetModule.id)
    .map((p) => p.prerequisite_module_id);

  const prerequisites: {
    id: string;
    moduleKey: string;
    title: string;
    sortOrder: number;
  }[] = [];

  for (const pId of targetPrereqIds) {
    const m = moduleMap.get(pId);
    if (m) {
      prerequisites.push({
        id: m.id,
        moduleKey: m.module_key,
        title: m.title,
        sortOrder: m.sort_order,
      });
    }
  }

  // Student progress
  const completedLessonIds = new Set<string>();
  const verifiedModuleIds = new Set<string>();

  if (userId && enrollmentId) {
    const [{ data: lessonProg }, { data: modProg }] = await Promise.all([
      supabase
        .from("student_lesson_progress")
        .select("lesson_id")
        .eq("enrollment_id", enrollmentId)
        .eq("user_id", userId),
      supabase
        .from("student_module_progress")
        .select("roadmap_module_id, status")
        .eq("enrollment_id", enrollmentId)
        .eq("user_id", userId),
    ]);

    for (const row of lessonProg ?? []) {
      completedLessonIds.add(row.lesson_id);
    }
    for (const row of modProg ?? []) {
      if (row.status === "completed" || row.status === "validated") {
        verifiedModuleIds.add(row.roadmap_module_id);
      }
    }
  }

  // Unlock check
  // Module detail content is only available to an authenticated student with
  // an active enrollment. The database function remains the authority for
  // prerequisite access; anonymous visitors may still preview the roadmap
  // overview, but cannot open learning content directly.
  let isAllowed = false;
  if (userId && enrollmentId) {
    const admin = createAdminClient();
    const { data: rpcUnlocked, error: rpcError } = await admin.rpc(
      "is_roadmap_module_unlocked",
      {
        p_user_id: userId,
        p_enrollment_id: enrollmentId,
        p_module_id: targetModule.id,
      },
    );

    if (!rpcError && typeof rpcUnlocked === "boolean") {
      isAllowed = rpcUnlocked;
    }
  }

  // Nest lesson resources inside lessons
  const resourcesByLesson = new Map<string, StudentLessonResource[]>();
  for (const r of lessonResourcesRaw ?? []) {
    const list = resourcesByLesson.get(r.lesson_id) ?? [];
    list.push({
      id: r.id,
      resourceKey: r.resource_key,
      title: r.title,
      resourceType: r.resource_type,
      url: r.url,
      provider: r.provider,
      description: r.description,
      language: r.language,
      durationMinutes: r.duration_minutes,
      isRequired: r.is_required,
    });
    resourcesByLesson.set(r.lesson_id, list);
  }

  // Nest lessons inside topics
  const lessonsByTopic = new Map<string, StudentLesson[]>();
  let totalLessons = 0;
  let completedLessons = 0;

  for (const l of lessonsRaw ?? []) {
    totalLessons++;
    const isCompleted = completedLessonIds.has(l.id);
    if (isCompleted) completedLessons++;

    const list = lessonsByTopic.get(l.roadmap_topic_id) ?? [];
    list.push({
      id: l.id,
      lessonKey: l.lesson_key,
      title: l.title,
      description: l.description,
      objectives: Array.isArray(l.objectives) ? l.objectives : [],
      sortOrder: l.sort_order,
      isRequired: l.is_required,
      isCompleted,
      resources: resourcesByLesson.get(l.id) ?? [],
    });
    lessonsByTopic.set(l.roadmap_topic_id, list);
  }

  // Topics
  const topics: StudentTopic[] = (topicsRaw ?? []).map((t) => ({
    id: t.id,
    topicKey: t.topic_key,
    slug: t.slug,
    title: t.title,
    description: t.description,
    sortOrder: t.sort_order,
    objectives: Array.isArray(t.objectives) ? t.objectives : [],
    estimatedDuration: t.estimated_duration,
    lessons: lessonsByTopic.get(t.id) ?? [],
  }));

  // Module status
  let status: "completed" | "current" | "locked" = "locked";
  if (!isAllowed) {
    status = "locked";
  } else if (
    verifiedModuleIds.has(targetModule.id) ||
    (totalLessons > 0 && completedLessons === totalLessons)
  ) {
    status = "completed";
  } else {
    status = "current";
  }

  const moduleResources: StudentModuleResource[] = (
    moduleResourcesRaw ?? []
  ).map((r) => ({
    id: r.id,
    resourceKey: r.resource_key,
    title: r.title,
    resourceType: r.resource_type,
    url: r.url,
    provider: r.provider,
    description: r.description,
    language: r.language,
    durationMinutes: r.duration_minutes,
    isRequired: r.is_required,
  }));

  return {
    id: targetModule.id,
    moduleKey: targetModule.module_key,
    sortOrder: targetModule.sort_order,
    title: targetModule.title,
    description: targetModule.description ?? "",
    estimatedDuration: targetModule.estimated_duration ?? "2-3 weeks",
    skills: Array.isArray(targetModule.skills) ? targetModule.skills : [],
    objectives: Array.isArray(targetModule.objectives)
      ? targetModule.objectives
      : [],
    completionCriteria: Array.isArray(targetModule.completion_criteria)
      ? targetModule.completion_criteria
      : [],
    status,
    isAllowed,
    prerequisites,
    previousModule,
    nextModule,
    moduleResources,
    topics,
    totalLessons,
    completedLessons,
  };
}
