import {
  curriculum,
  type ModuleStatus,
} from "@/lib/curriculum";

export type LearningProgress = {
  version: 1;
  completedModuleIds: string[];
  attemptsByModule: Record<string, number>;
  bestScoresByModule: Record<string, number>;
  latestScoresByModule: Record<string, number>;
};

export type QuizSubmissionResult =
  | {
      ok: true;
      score: number;
      correctCount: number;
      totalQuestions: number;
      passed: boolean;
      progress: LearningProgress;
    }
  | {
      ok: false;
      error: string;
      requiresAuth?: boolean;
    };

export type LearningProgressLoadResult =
  | {
      ok: true;
      authenticated: boolean;
      progress: LearningProgress;
    }
  | {
      ok: false;
      error: string;
    };

export const PROGRESS_STORAGE_KEY = "masar-learning-progress-v1";

export const emptyLearningProgress: LearningProgress = {
  version: 1,
  completedModuleIds: [],
  attemptsByModule: {},
  bestScoresByModule: {},
  latestScoresByModule: {},
};

export const defaultLearningProgress = emptyLearningProgress;

export function getProgressStatus(
  moduleId: string,
  completedModuleIds: string[],
): ModuleStatus {
  const item = curriculum.find((entry) => entry.id === moduleId);

  if (!item) {
    return "locked";
  }

  if (completedModuleIds.includes(moduleId)) {
    return "completed";
  }

  const prerequisitesCompleted = item.prerequisites.every((id) =>
    completedModuleIds.includes(id),
  );

  return prerequisitesCompleted ? "current" : "locked";
}

export function getNextAvailableModule(completedModuleIds: string[]) {
  return curriculum.find(
    (item) =>
      !completedModuleIds.includes(item.id) &&
      item.prerequisites.every((id) => completedModuleIds.includes(id)),
  );
}

export function normalizeLearningProgress(
  value: unknown,
): LearningProgress | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<LearningProgress>;

  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.completedModuleIds)
  ) {
    return null;
  }

  const validIds = new Set(curriculum.map((item) => item.id));

  const completedModuleIds = [
    ...new Set(
      candidate.completedModuleIds.filter(
        (id): id is string => typeof id === "string" && validIds.has(id),
      ),
    ),
  ];

  function normalizeScoreMap(
    input: unknown,
  ): Record<string, number> {
    if (typeof input !== "object" || input === null) {
      return {};
    }

    const result: Record<string, number> = {};

    for (const [key, rawValue] of Object.entries(input)) {
      if (
        validIds.has(key) &&
        typeof rawValue === "number" &&
        Number.isFinite(rawValue)
      ) {
        result[key] = rawValue;
      }
    }

    return result;
  }

  const attemptsByModule = normalizeScoreMap(candidate.attemptsByModule);

  for (const id of Object.keys(attemptsByModule)) {
    attemptsByModule[id] = Math.max(0, Math.floor(attemptsByModule[id]));
  }

  return {
    version: 1,
    completedModuleIds,
    attemptsByModule,
    bestScoresByModule: normalizeScoreMap(candidate.bestScoresByModule),
    latestScoresByModule: normalizeScoreMap(candidate.latestScoresByModule),
  };
}
