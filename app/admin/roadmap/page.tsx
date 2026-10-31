import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Save } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  createRoadmapModuleAction,
  updateRoadmapModuleAction,
  createRoadmapTopicAction,
  updateRoadmapTopicAction,
  archiveRoadmapTopicAction,
} from "@/app/admin/roadmap/actions";

export default async function RoadmapAdminPage() {
  await connection();

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

  if (!draftVersion) {
    return (
      <div className="page-container">
        <Link href="/admin" className="text-link">
          <ArrowLeft size={16} /> Back to Admin
        </Link>
        <section className="panel mt-5 p-6">
          <h1 className="text-2xl font-bold">No editable draft</h1>
          <p className="stat-note mt-2">
            There is no draft version available for editing. Published roadmaps
            are protected from direct changes.
          </p>
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
    <div className="page-container">
      <Link href="/admin" className="text-link inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Admin
      </Link>

      <header className="page-heading mt-5">
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
      </header>

      <section className="panel p-5 mb-7">
        <h2 className="text-xl font-semibold">Add a Module</h2>
        <p className="stat-note mt-1">
          Create a new stage in this roadmap version.
        </p>

        <form
          action={createRoadmapModuleAction}
          className="admin-form-grid mt-5"
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
              {moduleList.map((module) => (
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

      <div className="space-y-6">
        {moduleList.map((module) => {
          const moduleTopics = topicsByModule.get(module.id) ?? [];
          const selectedPrerequisites =
            prerequisitesByModule.get(module.id) ?? [];

          return (
            <section className="panel p-5" key={module.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-xs text-gray-500">
                    Module {module.sort_order} · {module.module_key}
                  </p>
                  <h2 className="text-xl font-bold">{module.title}</h2>
                  <p className="stat-note mt-1">{moduleTopics.length} topics</p>
                </div>
                <span
                  className={`topic-status-badge ${
                    module.is_active
                      ? "screening_passed"
                      : "self_reported_unknown"
                  }`}
                >
                  {module.is_active ? "Active" : "Archived"}
                </span>
              </div>

              <div className="mt-3">
                <Link
                  href={`/admin/roadmap/modules/${module.id}`}
                  className="button-secondary inline-flex items-center gap-2"
                >
                  Manage Module Resources
                </Link>
              </div>
              <details>
                <summary className="cursor-pointer font-semibold">
                  Edit module details and prerequisites
                </summary>

                <form
                  action={updateRoadmapModuleAction}
                  className="admin-form-grid mt-5"
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
                        .filter((item) => item.id !== module.id)
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

              <div className="mt-6 border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-semibold">Topics</h3>
                  <span className="stat-note">{moduleTopics.length} total</span>
                </div>

                <div className="space-y-4">
                  {moduleTopics.map((topic) => (
                    <article
                      className="rounded-lg border border-gray-200 p-4"
                      key={topic.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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

                      <div className="mb-3">
                        <Link
                          href={`/admin/roadmap/topics/${topic.id}`}
                          className="button-secondary"
                        >
                          Manage Lessons & Resources
                        </Link>
                      </div>

                      <details>
                        <summary className="cursor-pointer text-sm font-semibold">
                          Edit topic
                        </summary>

                        <form
                          action={updateRoadmapTopicAction}
                          className="admin-form-grid mt-4"
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
                          className="mt-3"
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

                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold">
                    <Plus size={15} className="inline mr-1" />
                    Add a Topic
                  </summary>

                  <form
                    action={createRoadmapTopicAction}
                    className="admin-form-grid mt-4"
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
              </div>
            </section>
          );
        })}
      </div>

      <section className="panel p-5 mt-7">
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
