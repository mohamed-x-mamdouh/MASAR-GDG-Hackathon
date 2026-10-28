
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Compass,
  Target,
} from "lucide-react";
import {
  curriculum,
  demoCompletedModuleIds,
  demoCurrentModuleId,
} from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Student Dashboard",
};

export default function DashboardPage() {
  const currentModule = curriculum.find(
    (module) => module.id === demoCurrentModuleId
  );

  if (!currentModule) {
    throw new Error("The configured demo current module does not exist.");
  }

  const completedCount = demoCompletedModuleIds.length;
  const progress = Math.round((completedCount / curriculum.length) * 100);

  const recentModules = curriculum.filter((module) =>
    demoCompletedModuleIds.includes(module.id)
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
        <article className="stat-card">
          <div className="stat-label">
            <BookOpen size={17} /> Completed stages
          </div>
          <div className="stat-value">
            {completedCount}
            <span className="stat-note"> / {curriculum.length}</span>
          </div>
          <div className="stat-note">Demonstration progress</div>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            <Target size={17} /> Roadmap progress
          </div>
          <div className="stat-value">{progress}%</div>
          <div className="preview-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            <Clock3 size={17} /> Current focus
          </div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {currentModule.title}
          </div>
          <div className="stat-note">{currentModule.duration} estimated</div>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Continue your journey</h2>
            <Compass size={20} color="#5b4ce2" />
          </div>

          <div className="next-step">
            <span className="status-pill current">NEXT UP</span>
            <h3>{currentModule.title}</h3>
            <p>{currentModule.description}</p>
            <div className="module-meta" style={{ marginBottom: 18 }}>
              <span>
                <Clock3 size={14} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
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
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Recently completed</h2>
          </div>

          <div className="module-list">
            {recentModules.map((module) => (
              <Link
                href={`/roadmap/${module.id}`}
                className="resource-card"
                key={module.id}
              >
                <div className="step-icon">
                  <CheckCircle2 size={19} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3>{module.title}</h3>
                  <p>Completed in demo data</p>
                </div>
                <ArrowRight size={16} color="#858ba0" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <p className="stat-note" style={{ marginTop: 22 }}>
        This dashboard uses sample student progress. Real student accounts,
        persistent progress, assessments, and verified skills are not enabled yet.
      </p>
    </div>
  );
}
