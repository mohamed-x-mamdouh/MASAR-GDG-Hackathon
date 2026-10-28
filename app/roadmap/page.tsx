
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { curriculum, getModuleStatus } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Learning Roadmap",
  description: "Explore the complete Full-Stack Development learning path.",
};

const statusLabels = {
  completed: "Completed",
  current: "Current stage",
  locked: "Locked",
};

export default function RoadmapPage() {
  const completedCount = curriculum.filter(
    (module) => getModuleStatus(module.id) === "completed"
  ).length;

  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">Your learning path</span>
        <h1>The Full-Stack Roadmap</h1>
        <p>
          The entire journey, from understanding the web to building and
          deploying a complete application. Each stage has a purpose,
          prerequisites, and practical work.
        </p>
      </div>

      <section className="roadmap-overview">
        <div>
          <h2>Your journey at a glance</h2>
          <p>
            {curriculum.length} stages · {completedCount} completed in demo data
          </p>
        </div>
        <div style={{ minWidth: 170 }}>
          <div className="preview-stat">
            <span>Overall progress</span>
            <strong>
              {Math.round((completedCount / curriculum.length) * 100)}%
            </strong>
          </div>
          <div className="preview-progress">
            <span
              style={{
                width: `${(completedCount / curriculum.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </section>

      <div className="module-list roadmap-track">
        {curriculum.map((module) => {
          const status = getModuleStatus(module.id);
          const StatusIcon =
            status === "completed"
              ? CheckCircle2
              : status === "current"
                ? ArrowRight
                : LockKeyhole;

          return (
            <article
              className={`roadmap-card ${status === "locked" ? "is-locked" : ""}`}
              key={module.id}
            >
              <Link
                href={`/roadmap/${module.id}`}
                className="module-card"
                aria-label={`View module ${module.number}: ${module.title}`}
              >
                <div className="module-number">{module.number}</div>

                <div className="module-content">
                  <div className="module-meta" style={{ marginBottom: 7 }}>
                    <span className={`status-pill ${status}`}>
                      <StatusIcon size={13} />
                      {statusLabels[status]}
                    </span>
                    <span>
                      <Clock3 size={13} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                      {module.duration}
                    </span>
                  </div>

                  <h3>{module.title}</h3>
                  <p>{module.description}</p>

                  <div className="module-meta">
                    {module.skills.map((skill) => (
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
        Progress and stage statuses currently use demonstration data.
        Completion and prerequisite enforcement will be connected to the
        assessment and progress system later.
      </p>
    </div>
  );
}
