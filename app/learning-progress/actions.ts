"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";
import { quizzes } from "@/lib/quizzes";
import {
  emptyLearningProgress,
  type LearningProgress,
  type LearningProgressLoadResult,
  type QuizSubmissionResult,
} from "@/lib/learning-progress";

async function readUserProgress(
  userId: string,
): Promise<LearningProgress> {
  const admin = createAdminClient();

  const [
    { data: moduleRows, error: moduleError },
    { data: attempts, error: attemptsError },
  ] = await Promise.all([
    admin
      .from("module_progress")
      .select("module_id, status")
      .eq("user_id", userId),

    admin
      .from("quiz_attempts")
      .select("module_id, score, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (moduleError) throw moduleError;
  if (attemptsError) throw attemptsError;

  const verifiedIds = new Set(
    (moduleRows ?? [])
      .filter(
        (row) =>
          row.status === "completed" ||
          row.status === "validated",
      )
      .map((row) => row.module_id),
  );

  const completedModuleIds = curriculum
    .filter((item) => verifiedIds.has(item.id))
    .map((item) => item.id);

  const attemptsByModule: Record<string, number> = {};
  const bestScoresByModule: Record<string, number> = {};
  const latestScoresByModule: Record<string, number> = {};

  for (const attempt of attempts ?? []) {
    const moduleId = attempt.module_id;
    const score = attempt.score;

    attemptsByModule[moduleId] =
      (attemptsByModule[moduleId] ?? 0) + 1;

    bestScoresByModule[moduleId] = Math.max(
      bestScoresByModule[moduleId] ?? 0,
      score,
    );

    // Results are ordered oldest to newest, so the last
    // score processed becomes the latest score.
    latestScoresByModule[moduleId] = score;
  }

  return {
    version: 1,
    completedModuleIds,
    attemptsByModule,
    bestScoresByModule,
    latestScoresByModule,
  };
}

export async function getLearningProgressAction():
  Promise<LearningProgressLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: true,
      authenticated: false,
      progress: emptyLearningProgress,
    };
  }

  try {
    return {
      ok: true,
      authenticated: true,
      progress: await readUserProgress(user.id),
    };
  } catch (error) {
    console.error("Failed to load learning progress:", error);

    return {
      ok: false,
      error: "Couldn't load your saved progress. Please refresh the page.",
    };
  }
}

export async function submitModuleQuizAction(
  moduleId: string,
  answers: Record<string, string>,
): Promise<QuizSubmissionResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      requiresAuth: true,
      error: "Sign in before submitting a quiz so your progress can be saved.",
    };
  }

  const roadmapModule = curriculum.find(
    (item) => item.id === moduleId,
  );

  const quiz = quizzes.find(
    (item) => item.moduleId === moduleId,
  );

  if (!roadmapModule || !quiz) {
    return {
      ok: false,
      error: "This quiz doesn't exist.",
    };
  }

  if (
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    return {
      ok: false,
      error: "Invalid quiz answers.",
    };
  }

  const questionIds = quiz.questions.map(
    (question) => question.id,
  );

  if (
    Object.keys(answers).length !== questionIds.length ||
    !quiz.questions.every((question) => {
      const answer = answers[question.id];

      return (
        typeof answer === "string" &&
        question.options.some((option) => option.id === answer)
      );
    })
  ) {
    return {
      ok: false,
      error: "Please answer every question before submitting.",
    };
  }

  try {
    const admin = createAdminClient();

    if (roadmapModule.prerequisites.length > 0) {
      const { data: prerequisiteRows, error } = await admin
        .from("module_progress")
        .select("module_id")
        .eq("user_id", user.id)
        .in("module_id", roadmapModule.prerequisites)
        .in("status", ["completed", "validated"]);

      if (error) throw error;

      const verifiedPrerequisites = new Set(
        (prerequisiteRows ?? []).map((row) => row.module_id),
      );

      const allPrerequisitesVerified =
        roadmapModule.prerequisites.every((id) =>
          verifiedPrerequisites.has(id),
        );

      if (!allPrerequisitesVerified) {
        return {
          ok: false,
          error: "Complete the prerequisite modules before taking this quiz.",
        };
      }
    }

    const correctCount = quiz.questions.filter(
      (question) =>
        answers[question.id] === question.correctOptionId,
    ).length;

    const score = Math.round(
      (correctCount / quiz.questions.length) * 100,
    );

    const passed = score >= quiz.passPercentage;

    const { error: attemptError } = await admin
      .from("quiz_attempts")
      .insert({
        user_id: user.id,
        module_id: moduleId,
        answers,
        score,
        passed,
      });

    if (attemptError) throw attemptError;

    if (passed) {
      const { error: progressError } = await admin
        .from("module_progress")
        .upsert(
          {
            user_id: user.id,
            module_id: moduleId,
            status: "completed",
            verification_source: "module_quiz",
            score,
            verified_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,module_id",
          },
        );

      if (progressError) throw progressError;
    }

    const progress = await readUserProgress(user.id);

    return {
      ok: true,
      score,
      correctCount,
      totalQuestions: quiz.questions.length,
      passed,
      progress,
    };
  } catch (error) {
    console.error("Failed to save quiz result:", error);

    return {
      ok: false,
      error: "We couldn't save your quiz result. Please try again.",
    };
  }
}