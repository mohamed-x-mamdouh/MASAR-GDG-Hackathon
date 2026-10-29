
"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { curriculum } from "@/lib/curriculum";
import { useLearningProgress } from "@/components/learning-progress-provider";

const statusLabels = {
  completed: "Completed",
  current: "Current stage",
  locked: "Locked",
} as const;

export default function RoadmapClient() {
  const { completedModuleIds, getStatus, hydrated } = useLearningProgress();

  if (!hydrated) {
    return (
      <div className="page-container">
        <p className="stat-note">Loading learning progress...</p>
      </div>
    );
  }

  const completedCount = completedModuleIds.length;
  const progress = Math.round((completedCount / curriculum.length) * 100);

  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">Your learning path</span>
        <h1>The Full-Stack Roadmap</h1>
        <p>
          The entire journey, from understanding the web to building and
          deploying a complete application. Pass each stage&apos;s quiz to
          unlock the next stage. Practical projects remain separate from
          progression.
        </p>
      </div>

      <section className="roadmap-overview">
        <div>
          <h2>Your journey at a glance</h2>
          <p>
            {curriculum.length} stages · {completedCount} completed
          </p>
        </div>

        <div style={{ minWidth: 170 }}>
          <div className="preview-stat">
            <span>Overall progress</span>
            <strong>{progress}%</strong>
          </div>
          <div
            className="preview-progress"
            role="progressbar"
            aria-label="Overall roadmap progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <div className="module-list roadmap-track">
        {curriculum.map((item) => {
          const status = getStatus(item.id);
          const StatusIcon =
            status === "completed"
              ? CheckCircle2
              : status === "current"
                ? ArrowRight
                : LockKeyhole;

          return (
            <article
              className={`roadmap-card ${status === "locked" ? "is-locked" : ""}`}
              key={item.id}
            >
              <Link
                href={`/roadmap/${item.id}`}
                className="module-card"
                aria-label={`View module ${item.number}: ${item.title}`}
              >
                <div className="module-number">{item.number}</div>

                <div className="module-content">
                  <div className="module-meta" style={{ marginBottom: 7 }}>
                    <span className={`status-pill ${status}`}>
                      <StatusIcon size={13} />
                      {statusLabels[status]}
                    </span>
                    <span>
                      <Clock3
                        size={13}
                        style={{ display: "inline", verticalAlign: "middle" }}
                      />{" "}
                      {item.duration}
                    </span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="module-meta">
                    {item.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </div>

                <ArrowRight size={19} color="#858ba0" />
              </Link>
            </article>
          );
        })}
      </div>

      <p className="stat-note" style={{ marginTop: 20 }}>
        Progress is saved in this browser for the prototype. A completed quiz
        unlocks the next eligible stage; mentor review is not required.
      </p>
    </div>
  );
}
