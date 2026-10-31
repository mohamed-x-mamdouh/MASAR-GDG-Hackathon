import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, BookOpen, ExternalLink, Library, Plus, Save } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archiveLessonAction,
  archiveResourceAction,
  createLessonAction,
  createResourceAction,
  updateLessonAction,
  updateResourceAction,
} from "@/app/admin/roadmap/content-actions";

const RESOURCE_TYPES = [
  ["youtube_video", "YouTube video"],
  ["documentation", "Documentation"],
  ["article", "Article"],
  ["external_course", "External course"],
  ["practice", "Practice"],
  ["interactive", "Interactive"],
  ["pdf", "PDF"],
] as const;

export const instant = false;

type PageProps = {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Feedback({ success, error }: { success?: string; error?: string }) {
  if (success) {
    return (
      <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        {success}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
        {error}
      </div>
    );
  }

  return null;
}

export default async function TopicContentAdminPage({ params, searchParams }: PageProps) {
  await connection();
  const [{ topicId }, query] = await Promise.all([params, searchParams]);
  const successMessage = typeof query.success === "string" ? query.success : undefined;
  const errorMessage = typeof query.error === "string" ? query.error : undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: topic, error: topicError } = await admin
    .from("roadmap_topics")
    .select("id, roadmap_version_id, roadmap_module_id, slug, title, description, is_active")
    .eq("id", topicId)
    .maybeSingle();

  if (topicError) {
    console.error("Failed to load roadmap topic:", topicError);
    throw new Error("Couldn't load this topic.");
  }
  if (!topic) notFound();

  const { data: version, error: versionError } = await admin
    .from("roadmap_versions")
    .select("id, version_number, status")
    .eq("id", topic.roadmap_version_id)
    .maybeSingle();

  if (versionError || !version) {
    console.error("Failed to load roadmap version:", versionError);
    throw new Error("Couldn't load the roadmap version.");
  }
  if (version.status !== "draft" || !topic.is_active) {
    return (
      <main className="page-container">
        <Link href="/admin/roadmap" className="text-link inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Roadmap Admin
        </Link>
        <section className="panel mt-5 p-6">
          <h1 className="text-xl font-bold">
            {topic.is_active ? "This roadmap version is read-only" : "This topic is archived"}
          </h1>
          <p className="stat-note mt-2">
            {topic.is_active
              ? "Lessons and resources can only be changed in a draft version."
              : "Archived topics are read-only. Restore the topic before managing its lessons and resources."}
          </p>
        </section>
      </main>
    );
  }

  const { data: moduleRecord, error: moduleError } = await admin
    .from("roadmap_modules")
    .select("id, title, module_key")
    .eq("id", topic.roadmap_module_id)
    .eq("roadmap_version_id", topic.roadmap_version_id)
    .maybeSingle();

  if (moduleError || !moduleRecord) {
    console.error("Failed to load topic module:", moduleError);
    throw new Error("Couldn't load the parent module.");
  }

  const { data: lessons, error: lessonsError } = await admin
    .from("learning_lessons")
    .select("id, lesson_key, title, description, objectives, sort_order, is_required, is_active")
    .eq("roadmap_topic_id", topic.id)
    .eq("roadmap_version_id", version.id)
    .order("sort_order", { ascending: true });

  if (lessonsError) {
    console.error("Failed to load lessons:", lessonsError);
    throw new Error("Couldn't load lessons for this topic.");
  }

  const lessonList = lessons ?? [];
  const lessonIds = lessonList.map((lesson) => lesson.id);
  const { data: resources, error: resourcesError } = lessonIds.length
    ? await admin
        .from("learning_resources")
        .select("id, lesson_id, resource_key, title, resource_type, url, provider, description, language, duration_seconds, is_required, sort_order, is_active")
        .eq("roadmap_version_id", version.id)
        .in("lesson_id", lessonIds)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (resourcesError) {
    console.error("Failed to load lesson resources:", resourcesError);
    throw new Error("Couldn't load learning resources.");
  }

  type ResourceRecord = NonNullable<typeof resources>[number];
  const resourcesByLesson = new Map<string, ResourceRecord[]>();
  for (const resource of resources ?? []) {
    const current = resourcesByLesson.get(resource.lesson_id) ?? [];
    current.push(resource);
    resourcesByLesson.set(resource.lesson_id, current);
  }

  return (
    <main className="page-container">
      <Link href="/admin/roadmap" className="text-link inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Roadmap Admin
      </Link>

      <header className="page-heading mt-5">
        <span className="eyebrow"><BookOpen size={15} className="inline mr-1" /> Lesson & Resource Management</span>
        <h1>{topic.title}</h1>
        <p>{moduleRecord.title} · Draft version {version.version_number}</p>
        {topic.description ? <p className="stat-note mt-2">{topic.description}</p> : null}
        <div className="mt-4">
          <Link
            href={`/admin/roadmap/modules/${moduleRecord.id}`}
            className="button-secondary inline-flex items-center gap-2"
          >
            <Library size={16} /> Manage Module-wide Resources
          </Link>
        </div>
      </header>

      <Feedback success={successMessage} error={errorMessage} />

      <section className="panel p-5 mb-7">
        <h2 className="text-xl font-semibold">Add a lesson</h2>
        <p className="stat-note mt-1">Lessons are ordered learning units inside this topic.</p>
        <form action={createLessonAction} className="admin-form-grid mt-5">
          <input type="hidden" name="versionId" value={version.id} />
          <input type="hidden" name="topicId" value={topic.id} />

          <label className="admin-field">
            <span>Lesson key</span>
            <input name="lessonKey" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. variables-and-types" />
          </label>
          <label className="admin-field">
            <span>Lesson title</span>
            <input name="title" required placeholder="e.g. Variables and Data Types" />
          </label>
          <label className="admin-field">
            <span>Order</span>
            <input name="sortOrder" type="number" min="1" defaultValue={lessonList.length + 1} required />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Description</span>
            <textarea name="description" rows={2} placeholder="What will the student learn in this lesson?" />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Learning objectives (one per line)</span>
            <textarea name="objectives" rows={3} placeholder="Declare variables using let and const" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isRequired" defaultChecked /> Required lesson
          </label>
          <button type="submit" className="button-primary admin-submit"><Plus size={16} /> Create Lesson</button>
        </form>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Lessons</h2>
        <span className="stat-note">{lessonList.length} lessons</span>
      </div>

      <div className="space-y-6">
        {lessonList.map((lesson) => {
          const lessonResources = resourcesByLesson.get(lesson.id) ?? [];
          return (
            <section className="panel p-5" key={lesson.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">Lesson {lesson.sort_order} · {lesson.lesson_key}</p>
                  <h2 className="text-lg font-bold">{lesson.title}</h2>
                  <p className="stat-note">{lessonResources.length} resources · {lesson.is_required ? "Required" : "Optional"} · {lesson.is_active ? "Active" : "Archived"}</p>
                </div>
                {lesson.is_active ? <span className="topic-status-badge screening_passed">Active</span> : <span className="topic-status-badge self_reported_unknown">Archived</span>}
              </div>

              {lesson.is_active ? (
              <details>
                <summary className="cursor-pointer font-semibold">Edit lesson details</summary>
                <form action={updateLessonAction} className="admin-form-grid mt-4">
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="topicId" value={topic.id} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <label className="admin-field">
                    <span>Lesson key</span>
                    <input name="lessonKey" required defaultValue={lesson.lesson_key} />
                  </label>
                  <label className="admin-field">
                    <span>Lesson title</span>
                    <input name="title" required defaultValue={lesson.title} />
                  </label>
                  <label className="admin-field">
                    <span>Order</span>
                    <input name="sortOrder" type="number" min="1" required defaultValue={lesson.sort_order} />
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Description</span>
                    <textarea name="description" rows={2} defaultValue={lesson.description} />
                  </label>
                  <label className="admin-field admin-field-wide">
                    <span>Objectives (one per line)</span>
                    <textarea name="objectives" rows={3} defaultValue={(lesson.objectives ?? []).join("\n")} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isRequired" defaultChecked={lesson.is_required} /> Required lesson
                  </label>
                  <button type="submit" className="button-primary admin-submit"><Save size={16} /> Save Lesson</button>
                </form>
              </details>

              ) : null}

              {lesson.is_active ? (
                <form action={archiveLessonAction} className="mt-3">
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="topicId" value={topic.id} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <button type="submit" className="button-secondary">Archive lesson</button>
                </form>
              ) : null}

              <div className="mt-6 border-t border-gray-200 pt-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Lesson-specific Resources</h3>
                    <p className="stat-note mt-1">Videos, articles, and exercises that support this lesson only.</p>
                  </div>
                  <span className="stat-note">{lessonResources.length} lesson resources</span>
                </div>

                <div className="space-y-4">
                  {lessonResources.map((resource) => (
                    <article key={resource.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">{resource.resource_type} · {resource.language} · Order {resource.sort_order}</p>
                          <h4 className="font-semibold">{resource.title}</h4>
                          <p className="stat-note break-all">{resource.url}</p>
                          <Link href={resource.url} target="_blank" rel="noreferrer" className="text-link inline-flex items-center gap-1 mt-1">
                            Open resource <ExternalLink size={13} />
                          </Link>
                          <p className="stat-note mt-1">{resource.is_required ? "Required" : "Optional"} · {resource.is_active ? "Active" : "Archived"}{resource.duration_seconds ? ` · ${resource.duration_seconds}s` : ""}</p>
                        </div>
                        {resource.is_active ? <span className="topic-status-badge screening_passed">Active</span> : <span className="topic-status-badge self_reported_unknown">Archived</span>}
                      </div>

                      {lesson.is_active && resource.is_active ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold">Edit resource</summary>
                        <form action={updateResourceAction} className="admin-form-grid mt-4">
                          <input type="hidden" name="versionId" value={version.id} />
                          <input type="hidden" name="topicId" value={topic.id} />
                          <input type="hidden" name="lessonId" value={lesson.id} />
                          <input type="hidden" name="resourceId" value={resource.id} />
                          <label className="admin-field"><span>Resource key</span><input name="resourceKey" required defaultValue={resource.resource_key} /></label>
                          <label className="admin-field"><span>Title</span><input name="title" required defaultValue={resource.title} /></label>
                          <label className="admin-field"><span>Type</span>
                            <select name="resourceType" defaultValue={resource.resource_type} required>
                              {RESOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </label>
                          <label className="admin-field"><span>Language</span>
                            <select name="language" defaultValue={resource.language} required>
                              <option value="en">English</option><option value="ar">Arabic</option><option value="other">Other</option>
                            </select>
                          </label>
                          <label className="admin-field admin-field-wide"><span>URL</span><input name="url" type="url" required defaultValue={resource.url} /></label>
                          <label className="admin-field"><span>Provider</span><input name="provider" defaultValue={resource.provider} placeholder="e.g. YouTube, MDN" /></label>
                          <label className="admin-field"><span>Duration (seconds, optional)</span><input name="durationSeconds" type="number" min="0" defaultValue={resource.duration_seconds ?? ""} /></label>
                          <label className="admin-field"><span>Order</span><input name="sortOrder" type="number" min="1" required defaultValue={resource.sort_order} /></label>
                          <label className="admin-field admin-field-wide"><span>Description</span><textarea name="description" rows={2} defaultValue={resource.description} /></label>
                          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" defaultChecked={resource.is_required} /> Required resource</label>
                          <button type="submit" className="button-primary admin-submit"><Save size={16} /> Save Resource</button>
                        </form>
                      </details>

                      ) : null}

                      {lesson.is_active && resource.is_active ? (
                        <form action={archiveResourceAction} className="mt-3">
                          <input type="hidden" name="versionId" value={version.id} />
                          <input type="hidden" name="topicId" value={topic.id} />
                          <input type="hidden" name="lessonId" value={lesson.id} />
                          <input type="hidden" name="resourceId" value={resource.id} />
                          <button type="submit" className="button-secondary">Archive resource</button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                  {lessonResources.length === 0 ? <p className="stat-note">No resources added to this lesson yet.</p> : null}
                </div>

                {lesson.is_active ? (
                  <details className="mt-5">
                    <summary className="cursor-pointer font-semibold"><Plus size={15} className="inline mr-1" /> Add a resource</summary>
                    <form action={createResourceAction} className="admin-form-grid mt-4">
                      <input type="hidden" name="versionId" value={version.id} />
                      <input type="hidden" name="topicId" value={topic.id} />
                      <input type="hidden" name="lessonId" value={lesson.id} />
                      <label className="admin-field"><span>Resource key</span><input name="resourceKey" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. mdn-let-const" /></label>
                      <label className="admin-field"><span>Title</span><input name="title" required placeholder="e.g. let and const - MDN" /></label>
                      <label className="admin-field"><span>Type</span>
                        <select name="resourceType" defaultValue="youtube_video" required>
                          {RESOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="admin-field"><span>Language</span>
                        <select name="language" defaultValue="en" required>
                          <option value="en">English</option><option value="ar">Arabic</option><option value="other">Other</option>
                        </select>
                      </label>
                      <label className="admin-field admin-field-wide"><span>URL</span><input name="url" type="url" required placeholder="https://..." /></label>
                      <label className="admin-field"><span>Provider</span><input name="provider" placeholder="e.g. YouTube, MDN" /></label>
                      <label className="admin-field"><span>Duration (seconds, optional)</span><input name="durationSeconds" type="number" min="0" /></label>
                      <label className="admin-field"><span>Order</span><input name="sortOrder" type="number" min="1" required defaultValue={lessonResources.length + 1} /></label>
                      <label className="admin-field admin-field-wide"><span>Description</span><textarea name="description" rows={2} /></label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" defaultChecked /> Required resource</label>
                      <button type="submit" className="button-primary admin-submit"><Plus size={16} /> Add Resource</button>
                    </form>
                  </details>
                ) : null}
              </div>
            </section>
          );
        })}
        {lessonList.length === 0 ? <section className="panel p-5 stat-note">No lessons in this topic yet. Create the first lesson above.</section> : null}
      </div>

      <section className="panel p-5 mt-7">
        <h2 className="font-semibold">Draft content only</h2>
        <p className="stat-note mt-2">Lessons and resources belong to Draft version {version.version_number}. They are not available to students until this roadmap version is validated and published.</p>
      </section>
    </main>
  );
}
