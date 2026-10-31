import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ArrowLeft, CopyPlus, Plus, Save, Send } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "./roadmap-builder.module.css";

import {
  createRoadmapModuleAction,
  updateRoadmapModuleAction,
  archiveRoadmapModuleAction,
  createRoadmapTopicAction,
  updateRoadmapTopicAction,
  archiveRoadmapTopicAction,
  publishRoadmapVersionAction,
  createRoadmapDraftFromPublishedAction,
} from "@/app/admin/roadmap/actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Feedback({ success, error }: { success?: string; error?: string }) {
  if (success) {
    return (
      <div
        role="status"
        className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
      >
        {success}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
      >
        {error}
      </div>
    );
  }

  return null;
}

export default async function RoadmapAdminPage({ searchParams }: PageProps) {
  await connection();
  const query = await searchParams;
  const successMessage =
    typeof query.success === "string" ? query.success : undefined;
  const errorMessage =
    typeof query.error === "string" ? query.error : undefined;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const { data: track, error: trackError } = await admin
    .from("learning_tracks")
    .select("id, title, description")
    .eq("slug", "full-stack-development")
    .maybeSingle();

  if (trackError) {
    console.error("Failed to load roadmap track:", trackError);
  }

  if (!track) {
    return (
      <div className="page-container">
        <Link href="/admin" className="text-link">
          <ArrowLeft size={16} /> Back to Admin
        </Link>
        <section className="panel mt-5 p-6">
          <h1 className="text-2xl font-bold">Roadmap not found</h1>
          <p className="stat-note mt-2">
            The Full-Stack Development track has not been created yet.
          </p>
        </section>
      </div>
    );
  }

  const { data: versions, error: versionsError } = await admin
    .from("roadmap_versions")
    .select("id, version_number, status, change_summary")
    .eq("track_id", track.id)
    .order("version_number", { ascending: false });

  if (versionsError) {
    console.error("Failed to load roadmap versions:", versionsError);
  }

  const draftVersion = (versions ?? []).find(
    (version) => version.status === "draft",
  );

  const publishedVersion = (versions ?? []).find(
    (version) => version.status === "published",
  );

  if (!draftVersion) {
    return (
      <div className="page-container">
        <Link href="/admin" className="text-link inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Admin
        </Link>
        <div className="mt-5">
          <Feedback success={successMessage} error={errorMessage} />
        </div>
        <section className="panel p-6">
          <h1 className="text-2xl font-bold">No editable draft</h1>
          <p className="stat-note mt-2">
            There is no draft version currently open for editing. Published roadmaps
            are protected from direct modifications.
          </p>
          {publishedVersion && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <div>
                <span className="font-semibold">Live Version:</span> Version{" "}
                {publishedVersion.version_number} is currently published and active for students.
              </div>
              <form
                action={createRoadmapDraftFromPublishedAction}
                className="mt-4"
              >
                <input
                  type="hidden"
                  name="sourceVersionId"
                  value={publishedVersion.id}
                />
                <button
                  type="submit"
                  className="button-primary inline-flex items-center gap-2"
                >
                  <CopyPlus size={16} /> Create New Draft from Published Version
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    );
  }

  const [
    { data: modules, error: modulesError },
    { data: prerequisites, error: prerequisitesError },
    { data: topics, error: topicsError },
  ] = await Promise.all([
    admin
      .from("roadmap_modules")
      .select(
        "id, module_key, sort_order, title, description, estimated_duration, skills, objectives, completion_criteria, is_active",
      )
      .eq("roadmap_version_id", draftVersion.id)
      .order("sort_order", { ascending: true }),

    admin
      .from("roadmap_module_prerequisites")
      .select("roadmap_module_id, prerequisite_module_id")
      .eq("roadmap_version_id", draftVersion.id),

    admin
      .from("roadmap_topics")
      .select(
        "id, roadmap_module_id, topic_key, slug, title, description, sort_order, objectives, estimated_duration, pass_percentage, questions_per_attempt, is_active",
      )
      .eq("roadmap_version_id", draftVersion.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (modulesError || prerequisitesError || topicsError) {
    console.error("Failed to load roadmap structure:", {
      modulesError,
      prerequisitesError,
      topicsError,
    });

    return (
      <div className="page-container">
        <section className="panel p-6">
          <h1 className="text-xl font-bold">
            Couldn&apos;t load the roadmap structure
          </h1>
          <p className="stat-note mt-2">
            Refresh the page or check the Supabase logs.
          </p>
        </section>
      </div>
    );
  }

  const moduleList = modules ?? [];
  const topicList = topics ?? [];

  const prerequisitesByModule = new Map<string, string[]>();

  for (const edge of prerequisites ?? []) {
    const current = prerequisitesByModule.get(edge.roadmap_module_id) ?? [];

    current.push(edge.prerequisite_module_id);

    prerequisitesByModule.set(edge.roadmap_module_id, current);
  }

  const topicsByModule = new Map<string, typeof topicList>();

  for (const topic of topicList) {
    const current = topicsByModule.get(topic.roadmap_module_id) ?? [];

    current.push(topic);

    topicsByModule.set(topic.roadmap_module_id, current);
  }

  const nextModuleOrder =
    Math.max(0, ...moduleList.map((module) => module.sort_order)) + 1;

  return (
    <div className={`page-container ${styles.builder}`}>
      <Link href="/admin" className="text-link inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Admin
      </Link>

      <header
        className={`page-heading mt-5 flex flex-wrap items-start justify-between gap-4 ${styles.header}`}
      >
        <div className={styles.headerCopy}>
          <span className="eyebrow">Roadmap Content Management</span>
          <h1>{track.title}</h1>
          <p>{track.description}</p>
          <div className="module-meta mt-3">
            <span>Draft version {draftVersion.version_number}</span>
            <span>·</span>
            <span>{moduleList.length} modules</span>
            <span>·</span>
            <span>{topicList.length} topics</span>
          </div>
        </div>

        <form
          action={publishRoadmapVersionAction}
          className={`flex items-center gap-3 ${styles.publishForm}`}
        >
          <input type="hidden" name="versionId" value={draftVersion.id} />
          <button
            type="submit"
            className="button-primary inline-flex items-center gap-2"
            title="Publish this draft version so students can access it"
          >
            <Send size={16} /> Publish Draft v{draftVersion.version_number}
          </button>
        </form>
      </header>

      <div className={styles.feedback}>
        <Feedback success={successMessage} error={errorMessage} />
      </div>

      <section className={`panel p-5 mb-7 ${styles.createPanel}`}>
        <div className={styles.createHeading}>
          <div>
            <h2 className="text-xl font-semibold">Add a Module</h2>
            <p className="stat-note mt-1">
              Create a new stage in this roadmap version.
            </p>
          </div>
          <span className="status-pill">Draft workspace</span>
        </div>

        <form
          action={createRoadmapModuleAction}
          className={`admin-form-grid mt-5 ${styles.form}`}
        >
          <input type="hidden" name="versionId" value={draftVersion.id} />

          <label className="admin-field">
            <span>Module key</span>
            <input
              name="moduleKey"
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="e.g. advanced-react"
            />
          </label>

          <label className="admin-field">
            <span>Module title</span>
            <input name="title" required placeholder="e.g. Advanced React" />
          </label>

          <label className="admin-field">
            <span>Order</span>
            <input
              name="sortOrder"
              type="number"
              min="1"
              required
              defaultValue={nextModuleOrder}
            />
          </label>

          <label className="admin-field">
            <span>Estimated duration</span>
            <input name="estimatedDuration" placeholder="e.g. 2 weeks" />
          </label>

          <label className="admin-field admin-field-wide">
            <span>Description</span>
            <textarea
              name="description"
              rows={2}
              placeholder="What does this module cover?"
            />
          </label>

          <label className="admin-field admin-field-wide">
            <span>Skills (one per line)</span>
            <textarea name="skills" rows={3} />
          </label>

          <label className="admin-field admin-field-wide">
            <span>Learning objectives (one per line)</span>
            <textarea name="objectives" rows={3} />
          </label>

          <label className="admin-field admin-field-wide">
            <span>Completion criteria (one per line)</span>
            <textarea name="completionCriteria" rows={3} />
          </label>

          <label className="admin-field admin-field-wide">
            <span>Prerequisites (select multiple)</span>
            <select
              name="prerequisiteModuleIds"
              multiple
              size={Math.min(Math.max(moduleList.length, 3), 7)}
            >
              {moduleList
                .filter((module) => module.is_active)
                .map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.sort_order}. {module.title}
                  </option>
                ))}
            </select>
            <small className="stat-note">
              Leave empty if this is a starting module.
            </small>
          </label>

          <button className="button-primary admin-submit" type="submit">
            <Plus size={17} /> Create Module
          </button>
        </form>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Roadmap Modules</h2>
        <span className="stat-note">{moduleList.length} modules</span>
      </div>

      <div className={`space-y-6 ${styles.moduleList}`}>
        {moduleList.map((module) => {
          const moduleTopics = topicsByModule.get(module.id) ?? [];
          const selectedPrerequisites =
            prerequisitesByModule.get(module.id) ?? [];

          return (
            <section
              className={`panel p-5 ${styles.moduleCard}`}
              key={module.id}
            >
              <div className={`flex flex-wrap items-start justify-between gap-3 mb-5 ${styles.moduleHeader}`}>
                <div>
                  <p className={`text-xs text-gray-500 ${styles.moduleKey}`}>
                    Module {module.sort_order} · {module.module_key}
                  </p>
                  <h2 className="text-xl font-bold">{module.title}</h2>
                  <p className="stat-note mt-1">{moduleTopics.length} topics</p>
                </div>
                <span
                  className={`topic-status-badge ${
                    module.is_active
                      ? `screening_passed ${styles.statusBadge}`
                      : `self_reported_unknown ${styles.statusBadge} ${styles.statusBadgeArchived}`
                  }`}
                >
                  {module.is_active ? "Active" : "Archived"}
                </span>
              </div>

              <div className={`mt-3 flex flex-wrap items-center gap-3 ${styles.actionBar}`}>
                <Link
                  href={`/admin/roadmap/modules/${module.id}`}
                  className="button-secondary inline-flex items-center gap-2"
                >
                  Manage Module Resources
                </Link>

                {module.is_active && (
                  <form action={archiveRoadmapModuleAction}>
                    <input
                      type="hidden"
                      name="versionId"
                      value={draftVersion.id}
                    />
                    <input type="hidden" name="moduleId" value={module.id} />
                    <button type="submit" className="button-secondary">
                      Archive module
                    </button>
                  </form>
                )}
              </div>

              {module.is_active ? (
                <details className={styles.disclosure}>
                  <summary className="cursor-pointer font-semibold">
                    Edit module details and prerequisites
                  </summary>

                <form
                  action={updateRoadmapModuleAction}
                  className={`admin-form-grid mt-5 ${styles.form}`}
                >
                  <input
                    type="hidden"
                    name="versionId"
                    value={draftVersion.id}
                  />
                  <input type="hidden" name="moduleId" value={module.id} />

                  <label className="admin-field">
                    <span>Module title</span>
                    <input name="title" required defaultValue={module.title} />
                  </label>

                  <label className="admin-field">
                    <span>Order</span>
                    <input
                      name="sortOrder"
                      type="number"
                      min="1"
                      required
                      defaultValue={module.sort_order}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Estimated duration</span>
                    <input
                      name="estimatedDuration"
                      defaultValue={module.estimated_duration ?? ""}
                    />
                  </label>

                  <label className="admin-field admin-field-wide">
                    <span>Description</span>
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={module.description ?? ""}
                    />
                  </label>

                  <label className="admin-field admin-field-wide">
                    <span>Skills (one per line)</span>
                    <textarea
                      name="skills"
                      rows={3}
                      defaultValue={(module.skills ?? []).join("\n")}
                    />
                  </label>

                  <label className="admin-field admin-field-wide">
                    <span>Learning objectives (one per line)</span>
                    <textarea
                      name="objectives"
                      rows={3}
                      defaultValue={(module.objectives ?? []).join("\n")}
                    />
                  </label>

                  <label className="admin-field admin-field-wide">
                    <span>Completion criteria (one per line)</span>
                    <textarea
                      name="completionCriteria"
                      rows={3}
                      defaultValue={(module.completion_criteria ?? []).join(
                        "\n",
                      )}
                    />
                  </label>

                  <label className="admin-field admin-field-wide">
                    <span>Prerequisites (select multiple)</span>
                    <select
                      name="prerequisiteModuleIds"
                      multiple
                      size={Math.min(Math.max(moduleList.length, 3), 7)}
                      defaultValue={selectedPrerequisites}
                    >
                      {moduleList
                        .filter(
                          (item) => item.id !== module.id && item.is_active,
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.sort_order}. {item.title}
                          </option>
                        ))}
                    </select>
                    <small className="stat-note">
                      Circular dependencies are rejected.
                    </small>
                  </label>

                  <button type="submit" className="button-primary admin-submit">
                    <Save size={16} /> Save Module
                  </button>
                </form>
              </details>
              ) : (
                <p className="stat-note mt-3">
                  This module is archived (read-only).
                </p>
              )}

              <div className={styles.topicArea}>
                <div className={`flex items-center justify-between gap-3 mb-4 ${styles.topicHeading}`}>
                  <h3 className="font-semibold">Topics</h3>
                  <span className="stat-note">{moduleTopics.length} total</span>
                </div>

                <div className="space-y-4">
                  {moduleTopics.map((topic) => (
                    <article
                      className={`rounded-lg border border-gray-200 p-4 ${styles.topicCard}`}
                      key={topic.id}
                    >
                      <div className={`flex flex-wrap items-center justify-between gap-2 mb-3 ${styles.topicHeader}`}>
                        <div>
                          <p className="text-xs text-gray-500">
                            Topic {topic.sort_order} · {topic.slug}
                          </p>
                          <h4 className="font-semibold">{topic.title}</h4>
                        </div>
                        <span
                          className={`topic-status-badge ${
                            topic.is_active
                              ? "screening_passed"
                              : "self_reported_unknown"
                          }`}
                        >
                          {topic.is_active ? "Active" : "Archived"}
                        </span>
                      </div>

                      <div className={styles.topicActions}>
                        <Link
                          href={`/admin/roadmap/topics/${topic.id}`}
                          className="button-secondary"
                        >
                          Manage Lessons & Resources
                        </Link>
                      </div>

                      <details className={styles.disclosure}>
                        <summary className="cursor-pointer text-sm font-semibold">
                          Edit topic
                        </summary>

                        <form
                          action={updateRoadmapTopicAction}
                          className={`admin-form-grid mt-4 ${styles.form}`}
                        >
                          <input
                            type="hidden"
                            name="versionId"
                            value={draftVersion.id}
                          />
                          <input
                            type="hidden"
                            name="topicId"
                            value={topic.id}
                          />

                          <label className="admin-field">
                            <span>Title</span>
                            <input
                              name="title"
                              required
                              defaultValue={topic.title}
                            />
                          </label>

                          <label className="admin-field">
                            <span>Order</span>
                            <input
                              name="sortOrder"
                              type="number"
                              min="1"
                              required
                              defaultValue={topic.sort_order}
                            />
                          </label>

                          <label className="admin-field">
                            <span>Estimated duration</span>
                            <input
                              name="estimatedDuration"
                              defaultValue={topic.estimated_duration ?? ""}
                            />
                          </label>

                          <label className="admin-field">
                            <span>Passing score (%)</span>
                            <input
                              name="passPercentage"
                              type="number"
                              min="0"
                              max="100"
                              defaultValue={topic.pass_percentage}
                            />
                          </label>

                          <label className="admin-field">
                            <span>Questions per attempt</span>
                            <input
                              name="questionsPerAttempt"
                              type="number"
                              min="1"
                              defaultValue={topic.questions_per_attempt}
                            />
                          </label>

                          <label className="admin-field admin-field-wide">
                            <span>Description</span>
                            <textarea
                              name="description"
                              rows={2}
                              defaultValue={topic.description ?? ""}
                            />
                          </label>

                          <label className="admin-field admin-field-wide">
                            <span>Learning objectives (one per line)</span>
                            <textarea
                              name="objectives"
                              rows={3}
                              defaultValue={(topic.objectives ?? []).join("\n")}
                            />
                          </label>

                          <button
                            type="submit"
                            className="button-primary admin-submit"
                          >
                            <Save size={16} /> Save Topic
                          </button>
                        </form>
                      </details>

                      {topic.is_active && (
                    <form
                          action={archiveRoadmapTopicAction}
                      className="mt-3 flex justify-end"
                        >
                          <input
                            type="hidden"
                            name="versionId"
                            value={draftVersion.id}
                          />
                          <input
                            type="hidden"
                            name="topicId"
                            value={topic.id}
                          />
                          <button type="submit" className="button-secondary">
                            Archive topic
                          </button>
                        </form>
                      )}
                    </article>
                  ))}

                  {moduleTopics.length === 0 && (
                    <p className="stat-note">No topics in this module yet.</p>
                  )}
                </div>

                {module.is_active ? (
                  <details className={`mt-5 ${styles.addTopic}`}>
                    <summary className="cursor-pointer font-semibold">
                      <Plus size={15} className="inline mr-1" />
                      Add a Topic
                    </summary>

                    <form
                      action={createRoadmapTopicAction}
                      className={`admin-form-grid mt-4 ${styles.form}`}
                    >
                      <input
                        type="hidden"
                        name="versionId"
                        value={draftVersion.id}
                      />
                      <input type="hidden" name="moduleId" value={module.id} />

                      <label className="admin-field">
                        <span>Topic slug</span>
                        <input
                          name="slug"
                          required
                          pattern="[a-z0-9]+(-[a-z0-9]+)*"
                          placeholder="e.g. react-hooks"
                        />
                      </label>

                      <label className="admin-field">
                        <span>Topic title</span>
                        <input
                          name="title"
                          required
                          placeholder="e.g. React Hooks"
                        />
                      </label>

                      <label className="admin-field">
                        <span>Order</span>
                        <input
                          name="sortOrder"
                          type="number"
                          min="1"
                          required
                          defaultValue={
                            Math.max(
                              0,
                              ...moduleTopics.map((item) => item.sort_order),
                            ) + 1
                          }
                        />
                      </label>

                      <label className="admin-field">
                        <span>Estimated duration</span>
                        <input
                          name="estimatedDuration"
                          placeholder="e.g. 3 hours"
                        />
                      </label>

                      <label className="admin-field">
                        <span>Passing score (%)</span>
                        <input
                          name="passPercentage"
                          type="number"
                          min="0"
                          max="100"
                          defaultValue={70}
                        />
                      </label>

                      <label className="admin-field">
                        <span>Questions per attempt</span>
                        <input
                          name="questionsPerAttempt"
                          type="number"
                          min="1"
                          defaultValue={5}
                        />
                      </label>

                      <label className="admin-field admin-field-wide">
                        <span>Description</span>
                        <textarea name="description" rows={2} />
                      </label>

                      <label className="admin-field admin-field-wide">
                        <span>Learning objectives (one per line)</span>
                        <textarea name="objectives" rows={3} />
                      </label>

                      <button
                        type="submit"
                        className="button-primary admin-submit"
                      >
                        <Plus size={16} /> Add Topic
                      </button>
                    </form>
                  </details>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <section className={`panel p-5 mt-7 ${styles.aboutDraft}`}>
        <h2 className="font-semibold">About this draft</h2>
        <p className="stat-note mt-2">
          Changes here affect draft version {draftVersion.version_number}
          only. Students will not see these changes until the roadmap is
          validated and published.
        </p>
      </section>
    </div>
  );
}
