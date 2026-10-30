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

import { curriculum } from "@/lib/curriculum-public";
import {
  emptyLearningProgress,
  getProgressStatus,
  PROGRESS_STORAGE_KEY,
  type LearningProgress,
  type QuizSubmissionResult,
} from "@/lib/learning-progress";

import {
  getLearningProgressAction,
  submitModuleQuizAction,
} from "@/app/learning-progress/actions";

import { createClient } from "@/lib/supabase/client";

type LearningProgressContextValue = LearningProgress & {
  hydrated: boolean;
  loadError: string | null;
  getStatus: (moduleId: string) => "completed" | "current" | "locked";
  recordQuizResult: (
    moduleId: string,
    answers: Record<string, string>,
  ) => Promise<QuizSubmissionResult>;
};

const LearningProgressContext =
  createContext<LearningProgressContextValue | null>(null);

export function LearningProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [progress, setProgress] = useState<LearningProgress>(
    emptyLearningProgress,
  );

  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const refreshProgress = async () => {
      const currentRequest = ++requestId;

      try {
        const result = await getLearningProgressAction();

        if (!active || currentRequest !== requestId) {
          return;
        }

        if (!result.ok) {
          setProgress(emptyLearningProgress);
          setLoadError(result.error);
        } else {
          setProgress(result.progress);
          setLoadError(null);
        }
      } catch {
        if (!active || currentRequest !== requestId) {
          return;
        }

        setProgress(emptyLearningProgress);
        setLoadError(
          "Couldn't load saved progress. Please refresh the page.",
        );
      } finally {
        if (active && currentRequest === requestId) {
          setHydrated(true);
        }
      }
    };

    // Remove the old demo progress saved by earlier versions.
    try {
      window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
    } catch {
      // Local storage may be unavailable.
    }

    void refreshProgress();

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        // Never show a previous account's progress while switching users.
        setProgress(emptyLearningProgress);
        setLoadError(null);
        setHydrated(false);

        queueMicrotask(() => {
          void refreshProgress();
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const recordQuizResult = useCallback(
    async (
      moduleId: string,
      answers: Record<string, string>,
    ): Promise<QuizSubmissionResult> => {
      const result = await submitModuleQuizAction(moduleId, answers);

      if (result.ok) {
        setProgress(result.progress);
        setLoadError(null);
      }

      return result;
    },
    [],
  );

  const value = useMemo<LearningProgressContextValue>(
    () => ({
      ...progress,
      hydrated,
      loadError,
      getStatus: (moduleId) =>
        curriculum.some((item) => item.id === moduleId)
          ? getProgressStatus(moduleId, progress.completedModuleIds)
          : "locked",
      recordQuizResult,
    }),
    [progress, hydrated, loadError, recordQuizResult],
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