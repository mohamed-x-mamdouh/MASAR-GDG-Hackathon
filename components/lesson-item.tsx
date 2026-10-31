"use client";

import { useTransition, useState } from "react";
import {
  CheckCircle2,
  Circle,
  BookOpen,
  ExternalLink,
  Clock3,
  Loader2,
} from "lucide-react";
import type { StudentLesson } from "@/lib/roadmap-student-types";
import { toggleLessonProgressAction } from "@/app/roadmap/actions";

type Props = {
  lesson: StudentLesson;
  moduleKey: string;
  isAllowed: boolean;
  isAuthenticated: boolean;
};

export default function LessonItem({
  lesson,
  moduleKey,
  isAllowed,
  isAuthenticated,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(lesson.isCompleted);

  const handleToggle = () => {
    if (!isAuthenticated || !isAllowed || isPending) return;

    const nextState = !completed;
    setCompleted(nextState);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("lessonId", lesson.id);
        formData.append("completed", nextState ? "true" : "false");
        formData.append("moduleKey", moduleKey);
        await toggleLessonProgressAction(formData);
      } catch (err) {
        console.error("Failed to toggle lesson progress:", err);
        setCompleted(!nextState); // Rollback on error
      }
    });
  };

  return (
    <article
      className={`rounded-xl border p-4 transition-all ${
        completed
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isAuthenticated && isAllowed ? (
            <button
              type="button"
              onClick={handleToggle}
              disabled={isPending}
              aria-label={
                completed
                  ? `Mark ${lesson.title} as incomplete`
                  : `Mark ${lesson.title} as complete`
              }
              className="mt-0.5 inline-flex cursor-pointer text-slate-400 transition-colors hover:text-emerald-600 focus:outline-none"
            >
              {isPending ? (
                <Loader2 size={20} className="animate-spin text-emerald-600" />
              ) : completed ? (
                <CheckCircle2 size={20} className="text-emerald-600" />
              ) : (
                <Circle size={20} className="hover:text-slate-600" />
              )}
            </button>
          ) : (
            <div className="mt-0.5 text-slate-300">
              <Circle size={20} />
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4
                className={`font-semibold ${
                  completed ? "text-slate-700 line-through decoration-slate-400" : "text-slate-900"
                }`}
              >
                {lesson.title}
              </h4>
              {lesson.isRequired ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Required
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Optional
                </span>
              )}
            </div>

            {lesson.description && (
              <p className="mt-1 text-sm text-slate-600">{lesson.description}</p>
            )}

            {lesson.objectives && lesson.objectives.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {lesson.objectives.map((obj, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-slate-400" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {isAllowed && lesson.resources && lesson.resources.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Lesson Resources
          </span>
          <div className="mt-2 space-y-2">
            {lesson.resources.map((resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs transition-colors hover:border-slate-300 hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-slate-500" />
                  <span className="font-medium text-slate-800">
                    {resource.title}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {resource.provider} ({resource.resourceType})
                  </span>
                  {resource.durationMinutes && (
                    <>
                      <span className="text-slate-400">·</span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Clock3 size={11} /> {resource.durationMinutes}m
                      </span>
                    </>
                  )}
                </div>
                <ExternalLink size={13} className="text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
