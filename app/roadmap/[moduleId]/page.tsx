
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleCheck,
  Clock3,
  ExternalLink,
  ListChecks,
  Target,
} from "lucide-react";

import {
  curriculum,
  getModuleById,
} from "@/lib/curriculum";

import {
  ModuleProgressBadge,
  ModuleQuizAction,
} from "@/components/module-progress";

import ModuleContentGate from "@/components/module-content-gate";

type Props = {
  params: Promise<{ moduleId: string }>;
};

export function generateStaticParams() {
  return curriculum.map((roadmapModule) => ({
    moduleId: roadmapModule.id,
  }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { moduleId } = await params;
  const roadmapModule = getModuleById(moduleId);

  return {
    title: roadmapModule ? roadmapModule.title : "Module not found",
  };
}

export default async function ModulePage({ params }: Props) {
  const { moduleId } = await params;
  const roadmapModule = getModuleById(moduleId);

  if (!roadmapModule) {
    notFound();
  }

  const previousModule = curriculum[roadmapModule.number - 2];
  const nextModule = curriculum[roadmapModule.number];

  const prerequisites = roadmapModule.prerequisites
    .map((id) => getModuleById(id))
    .filter((item) => item !== undefined);

  return (
    <div className="page-container">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/roadmap">Roadmap</Link>
        <span>/</span>
        <span>{roadmapModule.title}</span>
      </div>

      <section className="module-detail-header">
        <ModuleProgressBadge moduleId={roadmapModule.id} />

        <h1>
          <span className="text-accent">
            {String(roadmapModule.number).padStart(2, "0")}.
          </span>{" "}
          {roadmapModule.title}
        </h1>

        <p>{roadmapModule.description}</p>

        <div className="module-meta" style={{ marginTop: 20 }}>
          <span>
            <Clock3
              size={15}
              style={{ display: "inline", verticalAlign: "middle" }}
            />{" "}
            {roadmapModule.duration}
          </span>
          <span>·</span>
          <span>{roadmapModule.skills.length} focus skills</span>
        </div>

        <div className="hero-actions">
          <Link href="/roadmap" className="button-secondary">
            <ArrowLeft size={17} />
            Back to roadmap
          </Link>

          {nextModule && (
            <Link
              href={`/roadmap/${nextModule.id}`}
              className="button-primary"
            >
              Preview next stage
              <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </section>

      <div className="detail-columns">
        <div>
          <section className="panel detail-section">
            <h2>
              <Target
                size={19}
                style={{ display: "inline", verticalAlign: "middle" }}
              />{" "}
              Learning objectives
            </h2>

            <ul className="detail-list">
              {roadmapModule.objectives.map((objective) => (
                <li key={objective}>
                  <CheckCircle2 size={17} />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          <ModuleContentGate moduleId={roadmapModule.id}>
            <section className="panel detail-section">
              <h2>
                <BookOpen
                  size={19}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                Learning resources
              </h2>

              {roadmapModule.resources.map((resource) => (
                <a
                  className="resource-card"
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={resource.title}
                >
                  <div className="step-icon">
                    <BookOpen size={19} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3>{resource.title}</h3>
                    <p>
                      {resource.provider} · {resource.type}
                    </p>
                  </div>

                  <ExternalLink size={16} color="#858ba0" />
                </a>
              ))}
            </section>

            <section className="panel detail-section">
              <h2>
                <ListChecks
                  size={19}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                Completion criteria
              </h2>

              <ul className="detail-list">
                {roadmapModule.completionCriteria.map((criterion) => (
                  <li key={criterion}>
                    <CircleCheck size={17} />
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </section>
          </ModuleContentGate>
        </div>

        <aside>
          <section className="panel">
            <h2>Prerequisites</h2>

            {prerequisites.length === 0 ? (
              <p className="stat-note">
                No previous stages required. This is the starting point.
              </p>
            ) : (
              <ul className="detail-list">
                {prerequisites.map((prerequisite) => (
                  <li key={prerequisite.id}>
                    <CheckCircle2 size={17} />
                    <Link href={`/roadmap/${prerequisite.id}`}>
                      {prerequisite.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ModuleContentGate
            moduleId={roadmapModule.id}
            showLockedMessage={false}
          >
            <ModuleQuizAction moduleId={roadmapModule.id} />

            <section className="task-card detail-section">
              <span className="eyebrow">
                <ListChecks size={15} />
                Practical task
              </span>

              <h3>Put your knowledge to work</h3>
              <p>{roadmapModule.task}</p>

              <p className="stat-note">
                Submission and mentor review will be enabled when the backend
                workflow is implemented.
              </p>
            </section>
          </ModuleContentGate>

          <section className="panel detail-section">
            <h2>Skills covered</h2>

            <div className="module-meta">
              {roadmapModule.skills.map((skill) => (
                <span className="status-pill" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </section>

          {previousModule && (
            <Link
              href={`/roadmap/${previousModule.id}`}
              className="button-secondary"
              style={{ width: "100%", marginTop: 18 }}
            >
              <ArrowLeft size={16} />
              Previous stage
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
