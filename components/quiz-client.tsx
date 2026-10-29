
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";

import { curriculum } from "@/lib/curriculum";
import type { ModuleQuiz } from "@/lib/quizzes";
import { useLearningProgress } from "@/components/learning-progress-provider";
import type { QuizSubmissionResult } from "@/lib/learning-progress";

type Props = {
  moduleId: string;
  moduleTitle: string;
  quiz: ModuleQuiz;
};

export default function QuizClient({
  moduleId,
  moduleTitle,
  quiz,
}: Props) {
  const {
    hydrated,
    loadError,
    getStatus,
    recordQuizResult,
    attemptsByModule,
    bestScoresByModule,
  } = useLearningProgress();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<
    Extract<QuizSubmissionResult, { ok: true }> | null
  >(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [showIncompleteMessage, setShowIncompleteMessage] =
    useState(false);

  const submitted = submission !== null;
  const status = hydrated ? getStatus(moduleId) : "locked";

  const correctCount = submission?.correctCount ?? 0;
  const score = submission?.score ?? 0;
  const passed = submission?.passed ?? false;

  const nextModuleIndex =
    curriculum.findIndex((item) => item.id === moduleId) + 1;

  const nextModule = curriculum[nextModuleIndex];

  async function handleSubmit() {
    if (submitting || submitted) return;

    const allAnswered = quiz.questions.every(
      (item) => Boolean(answers[item.id]),
    );

    if (!allAnswered) {
      setShowIncompleteMessage(true);
      return;
    }

    setShowIncompleteMessage(false);
    setSubmitError(null);
    setRequiresAuth(false);
    setSubmitting(true);

    try {
      const result = await recordQuizResult(moduleId, answers);

      if (!result.ok) {
        setSubmitError(result.error);
        setRequiresAuth(Boolean(result.requiresAuth));
        return;
      }

      setSubmission(result);
    } catch {
      setSubmitError(
        "Something went wrong while saving your result. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setAnswers({});
    setSubmission(null);
    setSubmitError(null);
    setRequiresAuth(false);
    setShowIncompleteMessage(false);
  }

  if (!hydrated) {
    return (
      <div className="page-container">
        <p className="stat-note">Loading learning progress...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-container quiz-page">
        <p className="quiz-validation" role="alert">
          {loadError}
        </p>

        <Link href="/roadmap" className="text-link">
          <ArrowLeft size={16} /> Back to roadmap
        </Link>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="page-container quiz-page">
        <Link href="/roadmap" className="text-link">
          <ArrowLeft size={16} /> Back to roadmap
        </Link>

        <section className="panel quiz-result">
          <XCircle size={34} />

          <h1>This stage is locked</h1>

          <p>
            Complete the prerequisite stages by passing their
            quizzes before starting this one.
          </p>

          <Link href="/roadmap" className="button-primary">
            View prerequisites <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container quiz-page">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/roadmap">Roadmap</Link>
        <span>/</span>
        <Link href={`/roadmap/${moduleId}`}>
          {moduleTitle}
        </Link>
        <span>/</span>
        <span>Quiz</span>
      </div>

      <header className="quiz-header">
        <span className="eyebrow">Knowledge checkpoint</span>

        <h1>{quiz.title}</h1>

        <p>
          Answer all {quiz.questions.length} questions. You need{" "}
          {quiz.passPercentage}% to pass and unlock the next eligible
          stage.
        </p>

        <div className="module-meta">
          <span>{quiz.questions.length} questions</span>
          <span>·</span>
          <span>{quiz.passPercentage}% required to pass</span>
          <span>·</span>
          <span>
            Attempts: {attemptsByModule[moduleId] ?? 0}
          </span>

          {bestScoresByModule[moduleId] !== undefined && (
            <>
              <span>·</span>
              <span>
                Best score: {bestScoresByModule[moduleId]}%
              </span>
            </>
          )}
        </div>
      </header>

      {!submitted ? (
        <div className="quiz-questions">
          {quiz.questions.map((item, index) => (
            <section
              className="panel quiz-question-card"
              key={item.id}
            >
              <div className="quiz-question-number">
                Question {index + 1} of {quiz.questions.length}
              </div>

              <h2>{item.prompt}</h2>

              <div className="quiz-options">
                {item.options.map((option) => {
                  const selected = answers[item.id] === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`quiz-option ${
                        selected ? "is-selected" : ""
                      }`}
                      aria-pressed={selected}
                      disabled={submitting}
                      onClick={() => {
                        setAnswers((previous) => ({
                          ...previous,
                          [item.id]: option.id,
                        }));
                      }}
                    >
                      <span className="quiz-option-letter">
                        {option.id}
                      </span>

                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {showIncompleteMessage && (
            <p className="quiz-validation" role="alert">
              Please answer every question before submitting.
            </p>
          )}

          {submitError && (
            <p className="quiz-validation" role="alert">
              {submitError}{" "}
              {requiresAuth && (
                <Link href="/login" className="text-link">
                  Sign in
                </Link>
              )}
            </p>
          )}

          <div className="quiz-actions">
            <Link
              href={`/roadmap/${moduleId}`}
              className="button-secondary"
            >
              <ArrowLeft size={16} /> Back to module
            </Link>

            <button
              type="button"
              className="button-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Saving result..." : "Submit answers"}

              {!submitting && <ArrowRight size={17} />}
            </button>
          </div>
        </div>
      ) : (
        <section className="panel quiz-result">
          {passed ? (
            <Trophy size={40} />
          ) : (
            <XCircle size={40} />
          )}

          <span
            className={`status-pill ${
              passed ? "completed" : "locked"
            }`}
          >
            {passed ? "Quiz passed" : "Not passed yet"}
          </span>

          <h2>
            {score}% — {correctCount} of {quiz.questions.length} correct
          </h2>

          <p>
            {passed
              ? "You passed! Your result has been saved to your Masarak account, and the next eligible stage is now unlocked."
              : `You need at least ${quiz.passPercentage}% to pass. Review the explanations below, then try again.`}
          </p>

          <div className="quiz-review">
            {quiz.questions.map((item, index) => {
              const correct =
                answers[item.id] === item.correctOptionId;

              const correctAnswer = item.options.find(
                (option) => option.id === item.correctOptionId,
              );

              const selectedAnswer = item.options.find(
                (option) => option.id === answers[item.id],
              );

              return (
                <article
                  className="quiz-review-item"
                  key={item.id}
                >
                  <div className="quiz-review-heading">
                    {correct ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <XCircle size={18} />
                    )}

                    <h3>
                      {index + 1}. {item.prompt}
                    </h3>
                  </div>

                  <p>
                    Your answer:{" "}
                    {selectedAnswer?.label ?? "No answer"}
                  </p>

                  {!correct && (
                    <p>
                      Correct answer: {correctAnswer?.label}
                    </p>
                  )}

                  <p className="stat-note">
                    {item.explanation}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="quiz-actions">
            <Link
              href={`/roadmap/${moduleId}`}
              className="button-secondary"
            >
              Back to module
            </Link>

            {passed && nextModule ? (
              <Link
                href={`/roadmap/${nextModule.id}`}
                className="button-primary"
              >
                Continue to {nextModule.title}{" "}
                <ArrowRight size={17} />
              </Link>
            ) : passed ? (
              <Link href="/dashboard" className="button-primary">
                View dashboard <ArrowRight size={17} />
              </Link>
            ) : (
              <button
                type="button"
                className="button-primary"
                onClick={handleRetry}
              >
                <RotateCcw size={17} /> Try again
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
