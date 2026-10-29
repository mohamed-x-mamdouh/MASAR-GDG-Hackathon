"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, UploadCloud, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  placementQuestions,
  type PlacementSubmissionResult,
} from "@/lib/placement-assessment";
import { submitPlacementAssessmentAction } from "@/app/onboarding/actions";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export default function PlacementAssessmentClient() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadedCvPath, setUploadedCvPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<
    PlacementSubmissionResult,
    { ok: true }
  > | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || result) return;

    if (!placementQuestions.every((question) => answers[question.id])) {
      setError("Please answer every question before submitting.");
      return;
    }

    if (cvFile && cvFile.size > MAX_FILE_SIZE) {
      setError("Your CV must be 5 MB or smaller.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let cvPath = uploadedCvPath;

      if (cvFile && !cvPath) {
        const extension = cvFile.name.split(".").pop()?.toLowerCase();

        if (!extension || !MIME_TYPES[extension]) {
          setError("Upload your CV as a PDF, DOC, or DOCX file.");
          return;
        }

        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setError("Your session has expired. Sign in and try again.");
          return;
        }

        const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("student-cvs")
          .upload(filePath, cvFile, {
            contentType: MIME_TYPES[extension],
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`CV upload failed: ${uploadError.message}`);
        }

        cvPath = filePath;
        setUploadedCvPath(filePath);
      }

      const submission = await submitPlacementAssessmentAction(answers, cvPath);

      if (!submission.ok) {
        setError(submission.error);
        return;
      }

      setResult(submission);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't submit your assessment. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="panel p-6">
        <CheckCircle2 size={36} />

        <h2 className="mt-4 text-2xl font-semibold">Assessment completed</h2>

        <p className="mt-3">
          Your overall score is <strong>{result.overallScore}%</strong>.
        </p>

        <p className="mt-2">
          Modules validated through this assessment:{" "}
          <strong>{result.validatedModuleIds.length}</strong>.
        </p>

        <p className="mt-4">
          Your suggested starting point is{" "}
          <strong>{result.recommendedStartModuleTitle}</strong>.
        </p>

        <p className="mt-2 text-sm text-gray-500">
          This is an initial placement result based on your answers. Your CV has
          been stored privately if you attached one, but it has not been
          automatically analyzed yet.
        </p>

        <button
          type="button"
          className="button-primary mt-6"
          onClick={() => {
            router.push(`/roadmap/${result.recommendedStartModuleId}`);
          }}
        >
          Open recommended module <ArrowRight size={17} />
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="quiz-questions">
      <section className="panel p-6">
        <label htmlFor="placement-cv" className="block text-lg font-semibold">
          Attach your CV (optional)
        </label>

        <p className="mt-2 text-sm text-gray-500">
          PDF, DOC, or DOCX. Maximum size: 5 MB. Your file is kept in private
          storage.
        </p>

        <div className="mt-4">
          <input
            id="placement-cv"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={submitting}
            onChange={(event) => {
              setCvFile(event.target.files?.[0] ?? null);
              setUploadedCvPath(null);
              setError(null);
            }}
          />
        </div>

        {cvFile && (
          <p className="mt-3 text-sm">
            <UploadCloud size={16} className="mr-2 inline" />
            {cvFile.name}
          </p>
        )}

        {uploadedCvPath && (
          <p className="mt-2 text-sm">
            CV uploaded. It will be attached to this assessment.
          </p>
        )}
      </section>

      {placementQuestions.map((question, index) => (
        <section key={question.id} className="panel quiz-question-card">
          <div className="quiz-question-number">
            Question {index + 1} of {placementQuestions.length}
          </div>

          <h2>{question.prompt}</h2>

          <div className="quiz-options">
            {question.options.map((option) => {
              const selected = answers[question.id] === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`quiz-option ${selected ? "is-selected" : ""}`}
                  aria-pressed={selected}
                  disabled={submitting}
                  onClick={() => {
                    setAnswers((previous) => ({
                      ...previous,
                      [question.id]: option.id,
                    }));
                    setError(null);
                  }}
                >
                  <span className="quiz-option-letter">
                    {option.id.toUpperCase()}
                  </span>

                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {error && (
        <p role="alert" className="quiz-validation">
          {error}
        </p>
      )}

      <div className="quiz-actions">
        <span className="stat-note">
          {Object.keys(answers).length} of {placementQuestions.length} answered
        </span>

        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit assessment"}
          {!submitting && <ArrowRight size={17} />}
        </button>
      </div>
    </form>
  );
}
