
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

    // Results are ordered oldest to newest.
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

    // Construct the immutable snapshot on the server.
    // The answer keys never come from the browser.
    const questionSnapshot = quiz.questions.map((question) => ({
      question_id: question.id,
      prompt: question.prompt,
      options: question.options,
      selected_option_id: answers[question.id],
      correct_option_id: question.correctOptionId,
      explanation: question.explanation,
    }));

    // One database transaction:
    // 1. Verify prerequisites.
    // 2. Calculate the score.
    // 3. Insert the quiz attempt.
    // 4. Insert the immutable question snapshots.
    // 5. Update module progress if passed.
    const { data: savedAttempt, error: saveError } =
      await admin.rpc("submit_module_quiz_attempt", {
        p_user_id: user.id,
        p_module_id: moduleId,
        p_answers: answers,
        p_question_snapshot: questionSnapshot,
        p_pass_percentage: quiz.passPercentage,
        p_prerequisite_module_ids: roadmapModule.prerequisites,
      });

    if (saveError) {
      const message = saveError.message.toLowerCase();

      if (message.includes("prerequisite")) {
        return {
          ok: false,
          error:
            "Complete the prerequisite modules before taking this quiz.",
        };
      }

      throw saveError;
    }

    if (
      !savedAttempt ||
      typeof savedAttempt !== "object" ||
      Array.isArray(savedAttempt)
    ) {
      throw new Error("The database returned an invalid quiz result.");
    }

    const result = savedAttempt as {
      attempt_id?: unknown;
      score?: unknown;
      correct_count?: unknown;
      total_questions?: unknown;
      passed?: unknown;
    };

    if (
      typeof result.attempt_id !== "string" ||
      typeof result.score !== "number" ||
      typeof result.correct_count !== "number" ||
      typeof result.total_questions !== "number" ||
      typeof result.passed !== "boolean" ||
      result.total_questions !== quiz.questions.length
    ) {
      throw new Error("The saved quiz result is incomplete.");
    }

    // Reload progress after the transaction has completed.
    const progress = await readUserProgress(user.id);

    // Feedback is returned only after the submission was saved.
    const review = quiz.questions.map((question) => ({
      questionId: question.id,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
    }));

    return {
      ok: true,
      score: result.score,
      correctCount: result.correct_count,
      totalQuestions: result.total_questions,
      passed: result.passed,
      review,
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
