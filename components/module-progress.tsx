
"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Target,
} from "lucide-react";
import { useLearningProgress } from "@/components/learning-progress-provider";

export function ModuleProgressBadge({ moduleId }: { moduleId: string }) {
  const { hydrated, getStatus } = useLearningProgress();

  if (!hydrated) {
    return <span className="status-pill">Loading status...</span>;
  }

  const status = getStatus(moduleId);

  return (
    <span className={`status-pill ${status}`}>
      {status === "completed" ? (
        <CheckCircle2 size={14} />
      ) : status === "current" ? (
        <Target size={14} />
      ) : (
        <LockKeyhole size={14} />
      )}

      {status === "completed"
        ? "Completed"
        : status === "current"
          ? "Ready to learn"
          : "Locked — prerequisites required"}
    </span>
  );
}

export function ModuleQuizAction({ moduleId }: { moduleId: string }) {
  const { hydrated, getStatus } = useLearningProgress();

  if (!hydrated) {
    return null;
  }

  const status = getStatus(moduleId);

  if (status === "locked") {
    return (
      <section className="panel detail-section">
        <h2>Knowledge checkpoint</h2>
        <p>
          Pass the prerequisite quizzes first. This module will unlock when
          its prerequisites are completed.
        </p>
        <Link href="/roadmap" className="button-secondary">
          View roadmap <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <section className="panel detail-section">
      <h2>Knowledge checkpoint</h2>
      <p>
        Check your understanding with a short quiz. Passing marks this module
        complete and unlocks the next eligible stage.
      </p>

      <Link
        href={`/roadmap/${moduleId}/quiz`}
        className="button-primary"
        style={{ width: "100%", marginTop: 12 }}
      >
        {status === "completed" ? "Review quiz" : "Start module quiz"}
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
