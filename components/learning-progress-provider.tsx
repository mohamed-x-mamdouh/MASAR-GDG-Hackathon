"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { curriculum } from "@/lib/curriculum";
import {
  defaultLearningProgress,
  getProgressStatus,
  normalizeLearningProgress,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
} from "@/lib/learning-progress";

type LearningProgressContextValue = LearningProgress & {
  hydrated: boolean;
  getStatus: (moduleId: string) => "completed" | "current" | "locked";
  recordQuizResult: (
    moduleId: string,
    score: number,
    passPercentage: number,
  ) => void;
};

const LearningProgressContext =
  createContext<LearningProgressContextValue | null>(null);

export function LearningProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [progress, setProgress] = useState<LearningProgress>(
    defaultLearningProgress,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PROGRESS_STORAGE_KEY);

      if (stored) {
        const normalized = normalizeLearningProgress(JSON.parse(stored));

        if (normalized) {
          void Promise.resolve().then(() => {
            setProgress(normalized);
          });
        }
      }
    } catch {
      // Keep the default demo state when storage is unavailable or invalid.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify(progress),
      );
    } catch {
      // The app remains usable if local storage is unavailable.
    }
  }, [progress, hydrated]);

  const recordQuizResult = useCallback(
    (moduleId: string, score: number, passPercentage: number) => {
      const boundedScore = Math.min(100, Math.max(0, Math.round(score)));
      const boundedPassPercentage = Math.min(100, Math.max(0, passPercentage));

      setProgress((previous) => {
        const moduleExists = curriculum.some((item) => item.id === moduleId);

        if (!moduleExists) {
          return previous;
        }

        const passed = boundedScore >= boundedPassPercentage;

        const completedModuleIds = passed
          ? [...new Set([...previous.completedModuleIds, moduleId])]
          : previous.completedModuleIds;

        // Keep the original curriculum order in saved progress.
        const orderedCompletedIds = curriculum
          .filter((item) => completedModuleIds.includes(item.id))
          .map((item) => item.id);

        return {
          version: 1,
          completedModuleIds: orderedCompletedIds,
          attemptsByModule: {
            ...previous.attemptsByModule,
            [moduleId]: (previous.attemptsByModule[moduleId] ?? 0) + 1,
          },
          bestScoresByModule: {
            ...previous.bestScoresByModule,
            [moduleId]: Math.max(
              previous.bestScoresByModule[moduleId] ?? 0,
              boundedScore,
            ),
          },
          latestScoresByModule: {
            ...previous.latestScoresByModule,
            [moduleId]: boundedScore,
          },
        };
      });
    },
    [],
  );

  const value = useMemo<LearningProgressContextValue>(
    () => ({
      ...progress,
      hydrated,
      getStatus: (moduleId) =>
        getProgressStatus(moduleId, progress.completedModuleIds),
      recordQuizResult,
    }),
    [progress, hydrated, recordQuizResult],
  );

  return (
    <LearningProgressContext.Provider value={value}>
      {children}
    </LearningProgressContext.Provider>
  );
}

export function useLearningProgress() {
  const context = useContext(LearningProgressContext);

  if (!context) {
    throw new Error(
      "useLearningProgress must be used inside LearningProgressProvider.",
    );
  }

  return context;
}
