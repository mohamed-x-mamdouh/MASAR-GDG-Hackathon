
"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Compass,
  Target,
} from "lucide-react";
import { Card, ProgressBar } from "@heroui/react";
import { curriculum } from "@/lib/curriculum";
import { useLearningProgress } from "@/components/learning-progress-provider";

export default function DashboardClient() {
  const { completedModuleIds, getStatus, hydrated } = useLearningProgress();

  if (!hydrated) {
    return (
      <div className="page-container">
        <p className="stat-note">Loading learning progress...</p>
      </div>
    );
  }

  const completedModules = curriculum.filter((item) =>
    completedModuleIds.includes(item.id),
  );
  const completedCount = completedModules.length;
  const progress = Math.round((completedCount / curriculum.length) * 100);
  const currentModule = curriculum.find(
    (item) => getStatus(item.id) === "current",
  );

  return (
    <div className="page-container">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">Student workspace</span>
          <h1>Your journey, at a glance.</h1>
          <p>
            See where you are, review your progress, and decide what to do next.
          </p>
        </div>

        <Link href="/roadmap" className="button-primary">
          Open roadmap <ArrowRight size={17} />
        </Link>
      </div>

      <div className="stats-grid">
        <Card className="stat-card">
          <div className="stat-label">
            <BookOpen size={17} /> Completed stages
          </div>
          <div className="stat-value">
            {completedCount}
            <span className="stat-note"> / {curriculum.length}</span>
          </div>
          <div className="stat-note">
            Progress saved in this browser
          </div>
        </Card>

        <Card className="stat-card">
          <div className="stat-label">
            <Target size={17} /> Roadmap progress
          </div>
          <div className="stat-value">{progress}%</div>
          <ProgressBar
            aria-label="Roadmap progress"
            value={progress}
            className="dashboard-progress"
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Card>

        <Card className="stat-card">
          <div className="stat-label">
            <Clock3 size={17} /> Current focus
          </div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {currentModule?.title ?? "All stages complete"}
          </div>
          <div className="stat-note">
            {currentModule
              ? `${currentModule.duration} estimated`
              : "You completed the entire roadmap."}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="panel">
          <div className="panel-heading">
            <h2>{currentModule ? "Continue your journey" : "Roadmap completed"}</h2>
            <Compass size={20} color="#5b4ce2" />
          </div>

          {currentModule ? (
            <div className="next-step">
              <span className="status-pill current">READY TO LEARN</span>
              <h3>{currentModule.title}</h3>
              <p>{currentModule.description}</p>

              <div className="module-meta" style={{ marginBottom: 18 }}>
                <span>
                  <Clock3
                    size={14}
                    style={{ display: "inline", verticalAlign: "middle" }}
                  />{" "}
                  {currentModule.duration}
                </span>
                <span>·</span>
                <span>{currentModule.skills.length} focus skills</span>
              </div>

              <Link
                href={`/roadmap/${currentModule.id}`}
                className="button-primary"
              >
                View current module <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <div className="next-step">
              <h3>Congratulations!</h3>
              <p>
                You passed the quizzes required to complete every stage in
                this demo roadmap.
              </p>
              <Link href="/roadmap" className="button-primary">
                Review roadmap <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </Card>

        <Card className="panel">
          <div className="panel-heading">
            <h2>Completed stages</h2>
          </div>

          <div className="module-list">
            {[...completedModules].reverse().slice(0, 4).map((item) => (
              <Link
                href={`/roadmap/${item.id}`}
                className="resource-card"
                key={item.id}
              >
                <div className="step-icon">
                  <CheckCircle2 size={19} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3>{item.title}</h3>
                  <p>
                    {typeof undefined === "undefined" &&
                    completedModuleIds.includes(item.id)
                      ? "Completed stage"
                      : "Learning stage"}
                  </p>
                </div>
                <ArrowRight size={16} color="#858ba0" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <p className="stat-note" style={{ marginTop: 22 }}>
        This prototype saves progress in this browser only. Student accounts,
        cross-device sync, and server-verified quiz results will be connected
        later.
      </p>
    </div>
  );
}
