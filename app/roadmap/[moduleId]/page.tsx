import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
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
  LockKeyhole,
  Target,
} from "lucide-react";

import { curriculum, getModuleById } from "@/lib/curriculum";
import { getModuleAccess } from "@/lib/module-access";

import ModuleTopicList from "@/components/module-topic-list";

import {
  ModuleProgressBadge,
  ModuleQuizAction,
} from "@/components/module-progress";

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
  await connection();

  const { moduleId } = await params;
  const roadmapModule = getModuleById(moduleId);

  if (!roadmapModule) {
    notFound();
  }

  const access = await getModuleAccess(moduleId);

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
          <ModuleTopicList moduleId={roadmapModule.id} />

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

          {!access.allowed ? (
            <section className="panel detail-section">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <LockKeyhole size={24} />

                <div>
                  <h2>
                    {access.authenticated
                      ? "Learning content locked"
                      : "Sign in to access learning content"}
                  </h2>

                  <p>
                    {access.authenticated
                      ? "Pass the quizzes for this module's prerequisites to unlock its learning resources, completion criteria, practical task, and knowledge checkpoint."
                      : "Sign in to your account to access your learning content and track your progress."}
                  </p>

                  {!access.authenticated && (
                    <Link
                      href="/login"
                      className="button-primary"
                      style={{ marginTop: 14 }}
                    >
                      Sign in
                      <ArrowRight size={17} />
                    </Link>
                  )}

                  <p className="stat-note">
                    You can preview the learning objectives and prerequisites
                    while this module is locked.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <>
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
            </>
          )}
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

          <section className="panel detail-section">
            <h2>Topic-level assessment</h2>

            <p className="stat-note">
              Your knowledge is checked topic by topic. Topics you have not
              verified yet remain available for focused assessment and
              learning.
            </p>

            <Link
              href="/onboarding/assessment"
              className="button-primary mt-4"
            >
              Assess topics
              <ArrowRight size={17} />
            </Link>
          </section>

          {access.allowed && (
            <>
              <ModuleQuizAction moduleId={roadmapModule.id} />

              <section className="task-card detail-section">
                <span className="eyebrow">
                  <ListChecks size={15} />
                  Practical task
                </span>

                <h3>Put your knowledge to work</h3>
                <p>{roadmapModule.task}</p>

                <p className="stat-note">
                  Submission and mentor review will be enabled when the
                  backend workflow is implemented.
                </p>
              </section>
            </>
          )}

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