import "server-only";

import { createClient } from "@/lib/supabase/server";
import { curriculum } from "@/lib/curriculum";

export type ModuleAccessResult = {
  authenticated: boolean;
  allowed: boolean;
};

export async function getModuleAccess(
  moduleId: string,
): Promise<ModuleAccessResult> {
  const roadmapModule = curriculum.find(
    (item) => item.id === moduleId,
  );

  if (!roadmapModule) {
    return {
      authenticated: false,
      allowed: false,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    return {
      authenticated: false,
      allowed: false,
    };
  }

  if (roadmapModule.prerequisites.length === 0) {
    return {
      authenticated: true,
      allowed: true,
    };
  }

  const { data: completedRows, error } = await supabase
    .from("module_progress")
    .select("module_id, status")
    .eq("user_id", user.id)
    .in("status", ["completed", "validated"]);

  if (error) {
    throw error;
  }

  const completedIds = new Set(
    (completedRows ?? []).map((row) => row.module_id),
  );

  const allowed = roadmapModule.prerequisites.every((id) =>
    completedIds.has(id),
  );

  return {
    authenticated: true,
    allowed,
  };
}