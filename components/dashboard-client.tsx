"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Compass,
  Target,
  ClipboardCheck,
} from "lucide-react";
import { Card, ProgressBar } from "@heroui/react";
import { curriculum } from "@/lib/curriculum-public";
import { useLearningProgress } from "@/components/learning-progress-provider";

export default function DashboardClient() {
  const { completedModuleIds, getStatus, hydrated, loadError } =
    useLearningProgress();

  if (!hydrated) {
    return (
      <div className="page-container">
        <p className="stat-note">Loading learning progress...</p>
      </div>
    );
  }

  const verifiedModules = curriculum.filter((item) =>
    completedModuleIds.includes(item.id),
  );

  const verifiedCount = verifiedModules.length;

  const progress = Math.round(
    (verifiedCount / curriculum.length) * 100,
  );

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

        <div className="dashboard-actions">
          <div className="hero-actions">
            <Link href="/roadmap" className="button-primary">
              Open roadmap <ArrowRight size={17} />
            </Link>

            <Link
              href="/onboarding/assessment"
              className="button-secondary"
            >
              <ClipboardCheck size={17} />
              Assess my current skills
            </Link>
          </div>

          <Link
            href="/onboarding/assessment"
            className="button-secondary"
          >
            Reassess skills
          </Link>
        </div>
      </div>

      {loadError && (
        <p className="quiz-validation" role="alert">
          {loadError}
        </p>
      )}

      <div className="stats-grid">
        <Card className="stat-card">
          <div className="stat-label">
            <BookOpen size={17} />
            Verified stages
          </div>

          <div className="stat-value">
            {verifiedCount}
            <span className="stat-note"> / {curriculum.length}</span>
          </div>

          <div className="stat-note">
            Verified through assessment or module quizzes
          </div>
        </Card>

        <Card className="stat-card">
          <div className="stat-label">
            <Target size={17} />
            Roadmap progress
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
            <Clock3 size={17} />
            Current focus
          </div>

          <div className="stat-value" style={{ fontSize: 22 }}>
            {currentModule?.title ?? "All current stages verified"}
          </div>

          <div className="stat-note">
            {currentModule
              ? `${currentModule.duration} estimated`
              : "Review the roadmap or reassess your skills."}
          </div>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="panel">
          <div className="panel-heading">
            <h2>
              {currentModule
                ? "Continue your journey"
                : "Review your learning path"}
            </h2>

            <Compass size={20} color="#5b4ce2" />
          </div>

          {currentModule ? (
            <div className="next-step">
              <span className="status-pill current">
                READY TO LEARN
              </span>

              <h3>{currentModule.title}</h3>

              <p>{currentModule.description}</p>

              <div
                className="module-meta"
                style={{ marginBottom: 18 }}
              >
                <span>
                  <Clock3
                    size={14}
                    style={{
                      display: "inline",
                      verticalAlign: "middle",
                    }}
                  />{" "}
                  {currentModule.duration}
                </span>

                <span>·</span>

                <span>
                  {currentModule.skills.length} focus skills
                </span>
              </div>

              <Link
                href={`/roadmap/${currentModule.id}`}
                className="button-primary"
              >
                View current module
                <ArrowRight size={17} />
              </Link>
            </div>
          ) : (
            <div className="next-step">
              <h3>Your current stages are verified.</h3>

              <p>
                You can review the provisional roadmap or reassess your skills
                to check your starting point again.
              </p>

              <div className="dashboard-actions">
                <Link href="/roadmap" className="button-primary">
                  Review roadmap
                </Link>

                <Link
                  href="/onboarding/assessment"
                  className="button-secondary"
                >
                  Reassess skills
                </Link>
              </div>
            </div>
          )}
        </Card>

        <Card className="panel">
          <div className="panel-heading">
            <h2>Verified stages</h2>
          </div>

          {verifiedModules.length > 0 ? (
            <div className="module-list">
              {[...verifiedModules]
                .reverse()
                .slice(0, 4)
                .map((item) => (
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

                      <p>Verified through a quiz or assessment</p>
                    </div>

                    <ArrowRight size={16} color="#858ba0" />
                  </Link>
                ))}
            </div>
          ) : (
            <p className="stat-note">
              No stages have been verified yet. Start with your current focus or
              take the skills assessment.
            </p>
          )}
        </Card>
      </div>

      <p className="stat-note" style={{ marginTop: 22 }}>
        The current roadmap and its assessment content are provisional and will
        be customized for Masarak.
      </p>
    </div>
  );
}