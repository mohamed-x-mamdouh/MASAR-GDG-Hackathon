"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  BookOpen,
} from "lucide-react";

import type { RoadmapOverviewData } from "@/lib/roadmap-student-types";

const statusLabels = {
  completed: "Completed",
  current: "Current stage",
  locked: "Locked",
} as const;

type Props = {
  data: RoadmapOverviewData;
  isAuthenticated: boolean;
};

export default function RoadmapClient({ data, isAuthenticated }: Props) {
  if (!data.hasPublishedRoadmap) {
    return (
      <div className="page-container">
        <div className="page-heading">
          <span className="eyebrow">Your learning path</span>
          <h1>{data.trackTitle}</h1>
          <p>{data.trackDescription}</p>
        </div>

        <section className="panel mt-6 p-6">
          <h2 className="text-xl font-bold">Roadmap Coming Soon</h2>
          <p className="stat-note mt-2">
            No published roadmap version is available at this time. An administrator
            will publish the curriculum shortly.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">Your learning path</span>

        <h1>{data.trackTitle}</h1>

        <p>{data.trackDescription}</p>
      </div>

      <section className="roadmap-overview">
        <div>
          <h2>Your journey at a glance</h2>

          <p>
            {data.modules.length} stages · {data.completedCount} completed
          </p>
        </div>

        <div style={{ minWidth: 170 }}>
          <div className="preview-stat">
            <span>Overall progress</span>
            <strong>{data.overallProgress}%</strong>
          </div>

          <div
            className="preview-progress"
            role="progressbar"
            aria-label="Overall roadmap progress"
            aria-valuenow={data.overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${data.overallProgress}%` }} />
          </div>
        </div>
      </section>

      <div className="module-list roadmap-track">
        {data.modules.map((item) => {
          const status = item.status;

          const StatusIcon =
            status === "completed"
              ? CheckCircle2
              : status === "current"
                ? ArrowRight
                : LockKeyhole;

          return (
            <article
              className={`roadmap-card ${
                status === "locked" ? "is-locked" : ""
              }`}
              key={item.id}
            >
              <Link
                href={`/roadmap/${item.moduleKey}`}
                className="module-card"
                aria-label={`View module ${item.sortOrder}: ${item.title}`}
              >
                <div className="module-number">{item.sortOrder}</div>

                <div className="module-content">
                  <div className="module-meta" style={{ marginBottom: 7 }}>
                    <span className={`status-pill ${status}`}>
                      <StatusIcon size={13} />
                      {statusLabels[status]}
                    </span>

                    <span>
                      <Clock3
                        size={13}
                        style={{
                          display: "inline",
                          verticalAlign: "middle",
                        }}
                      />{" "}
                      {item.estimatedDuration}
                    </span>

                    {item.totalLessons > 0 && (
                      <span>
                        <BookOpen
                          size={13}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                          }}
                        />{" "}
                        {item.completedLessons}/{item.totalLessons} lessons
                      </span>
                    )}
                  </div>

                  <h3>{item.title}</h3>

                  <p>{item.description}</p>

                  {item.skills && item.skills.length > 0 && (
                    <div className="module-meta">
                      {item.skills.map((skill) => (
                        <span key={skill}>{skill}</span>
                      ))}
                    </div>
                  )}
                </div>

                <ArrowRight size={19} color="#858ba0" />
              </Link>
            </article>
          );
        })}
      </div>

      <p className="stat-note" style={{ marginTop: 20 }}>
        {isAuthenticated
          ? "Progress is saved in your Masarak account. Completed lessons and assessments unlock subsequent stages."
          : "Sign in to track your progress and mark lessons as complete."}
      </p>
    </div>
  );
}