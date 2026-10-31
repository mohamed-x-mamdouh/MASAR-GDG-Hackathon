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
  Layers,
  ListChecks,
  LockKeyhole,
  Target,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getStudentModuleDetailData } from "@/lib/roadmap-student";
import { getQuizByModuleId } from "@/lib/quizzes";
import LessonItem from "@/components/lesson-item";

type Props = {
  params: Promise<{ moduleId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { moduleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const moduleData = await getStudentModuleDetailData(moduleId, user?.id);

  return {
    title: moduleData ? moduleData.title : "Module not found",
  };
}

export default async function ModulePage({ params }: Props) {
  await connection();

  const { moduleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const moduleData = await getStudentModuleDetailData(moduleId, user?.id);

  if (!moduleData) {
    notFound();
  }

  const hasQuiz = Boolean(getQuizByModuleId(moduleData.moduleKey));

  const StatusIcon =
    moduleData.status === "completed"
      ? CheckCircle2
      : moduleData.status === "current"
        ? Target
        : LockKeyhole;

  const statusLabel =
    moduleData.status === "completed"
      ? "Completed"
      : moduleData.status === "current"
        ? "Ready to learn"
        : "Locked — prerequisites required";

  return (
    <div className="page-container">
      <div className="breadcrumbs">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/roadmap">Roadmap</Link>
        <span>/</span>
        <span>{moduleData.title}</span>
      </div>

      <section className="module-detail-header">
        <span className={`status-pill ${moduleData.status}`}>
          <StatusIcon size={14} />
          {statusLabel}
        </span>

        <h1>
          <span className="text-accent">
            {String(moduleData.sortOrder).padStart(2, "0")}.
          </span>{" "}
          {moduleData.title}
        </h1>

        <p>{moduleData.description}</p>

        <div className="module-meta" style={{ marginTop: 20 }}>
          <span>
            <Clock3
              size={15}
              style={{ display: "inline", verticalAlign: "middle" }}
            />{" "}
            {moduleData.estimatedDuration}
          </span>

          <span>·</span>

          <span>{moduleData.skills.length} focus skills</span>

          {moduleData.totalLessons > 0 && (
            <>
              <span>·</span>
              <span>
                <BookOpen
                  size={15}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                {moduleData.completedLessons}/{moduleData.totalLessons} lessons
                completed
              </span>
            </>
          )}
        </div>

        <div className="hero-actions">
          <Link href="/roadmap" className="button-secondary">
            <ArrowLeft size={17} />
            Back to roadmap
          </Link>

          {moduleData.nextModule && (
            <Link
              href={`/roadmap/${moduleData.nextModule.moduleKey}`}
              className="button-primary"
            >
              Next stage
              <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </section>

      <div className="detail-columns">
        <div>
          {/* Topics and Lessons */}
          <section className="panel detail-section">
            <h2>
              <Layers
                size={19}
                style={{ display: "inline", verticalAlign: "middle" }}
              />{" "}
              Topics &amp; Lessons
            </h2>
            <p className="stat-note">
              Study each topic and mark lessons as complete as you progress.
            </p>

            {moduleData.topics.length === 0 ? (
              <p className="stat-note mt-4 italic">
                Lessons for this module are currently being prepared.
              </p>
            ) : (
              <div className="mt-5 space-y-6">
                {moduleData.topics.map((topic) => (
                  <div
                    key={topic.id}
                    id={`topic-${topic.id}`}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {topic.title}
                      </h3>
                      {topic.estimatedDuration && (
                        <span className="text-xs text-slate-500">
                          {topic.estimatedDuration}
                        </span>
                      )}
                    </div>

                    {topic.description && (
                      <p className="stat-note mt-1">{topic.description}</p>
                    )}

                    {topic.lessons.length === 0 ? (
                      <p className="stat-note mt-3 text-xs italic">
                        No lessons published in this topic yet.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {topic.lessons.map((lesson) => (
                          <LessonItem
                            key={lesson.id}
                            lesson={lesson}
                            moduleKey={moduleData.moduleKey}
                            isAllowed={moduleData.isAllowed}
                            isAuthenticated={Boolean(user)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Module-Wide Resources */}
          {moduleData.isAllowed && moduleData.moduleResources.length > 0 && (
            <section className="panel detail-section">
              <h2>
                <BookOpen
                  size={19}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                Module resources
              </h2>
              <p className="stat-note">
                Recommended general materials and guides for this entire module.
              </p>

              <div className="mt-4 space-y-3">
                {moduleData.moduleResources.map((resource) => (
                  <a
                    className="resource-card"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={resource.id}
                  >
                    <div className="step-icon">
                      <BookOpen size={19} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3>{resource.title}</h3>
                      <p>
                        {resource.provider} · {resource.resourceType}
                        {resource.durationMinutes &&
                          ` · ${resource.durationMinutes} mins`}
                      </p>
                      {resource.description && (
                        <p className="stat-note mt-1">{resource.description}</p>
                      )}
                    </div>

                    <ExternalLink size={16} color="#858ba0" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Learning Objectives */}
          {moduleData.objectives.length > 0 && (
            <section className="panel detail-section">
              <h2>
                <Target
                  size={19}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />{" "}
                Learning objectives
              </h2>

              <ul className="detail-list">
                {moduleData.objectives.map((objective) => (
                  <li key={objective}>
                    <CheckCircle2 size={17} />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Completion Criteria */}
          {moduleData.isAllowed &&
            moduleData.completionCriteria.length > 0 && (
              <section className="panel detail-section">
                <h2>
                  <ListChecks
                    size={19}
                    style={{ display: "inline", verticalAlign: "middle" }}
                  />{" "}
                  Completion criteria
                </h2>

                <ul className="detail-list">
                  {moduleData.completionCriteria.map((criterion) => (
                    <li key={criterion}>
                      <CircleCheck size={17} />
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

          {/* Locked Notice */}
          {!moduleData.isAllowed && (
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
                    {user
                      ? "Learning content locked"
                      : "Sign in to access learning content"}
                  </h2>

                  <p>
                    {user
                      ? "Complete the prerequisite modules to unlock this module's lessons, resources, and knowledge checkpoint."
                      : "Sign in to your account to access your learning content and track your progress."}
                  </p>

                  {!user && (
                    <Link
                      href="/login"
                      className="button-primary"
                      style={{ marginTop: 14 }}
                    >
                      Sign in
                      <ArrowRight size={17} />
                    </Link>
                  )}

                  <p className="stat-note" style={{ marginTop: 10 }}>
                    You can preview the learning objectives and prerequisites
                    while this module is locked.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside>
          {/* Prerequisites */}
          <section className="panel">
            <h2>Prerequisites</h2>

            {moduleData.prerequisites.length === 0 ? (
              <p className="stat-note">
                No previous stages required. This is a foundational stage.
              </p>
            ) : (
              <ul className="detail-list">
                {moduleData.prerequisites.map((prerequisite) => (
                  <li key={prerequisite.id}>
                    <CheckCircle2 size={17} />
                    <Link href={`/roadmap/${prerequisite.moduleKey}`}>
                      {prerequisite.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Knowledge checkpoint */}
          {hasQuiz && moduleData.isAllowed && (
            <section className="panel detail-section">
              <h2>Knowledge checkpoint</h2>
              <p>
                Check your understanding with a short quiz. Passing verifies
                this module and unlocks subsequent learning.
              </p>

              <Link
                href={`/roadmap/${moduleData.moduleKey}/quiz`}
                className="button-primary"
                style={{ width: "100%", marginTop: 12 }}
              >
                {moduleData.status === "completed"
                  ? "Review quiz"
                  : "Start module quiz"}
                <ArrowRight size={16} />
              </Link>
            </section>
          )}

          {/* Skills Covered */}
          {moduleData.skills.length > 0 && (
            <section className="panel detail-section">
              <h2>Skills covered</h2>

              <div className="module-meta">
                {moduleData.skills.map((skill) => (
                  <span className="status-pill" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Navigation to Previous Stage */}
          {moduleData.previousModule && (
            <Link
              href={`/roadmap/${moduleData.previousModule.moduleKey}`}
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
