import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ExternalLink, Plus, Save } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  archiveModuleResourceAction,
  createModuleResourceAction,
  updateModuleResourceAction,
} from "@/app/admin/roadmap/module-resource-actions";

export const instant = false;

const RESOURCE_TYPES = [
  ["youtube_video", "YouTube video"],
  ["documentation", "Documentation"],
  ["article", "Article"],
  ["external_course", "External course"],
  ["practice", "Practice"],
  ["interactive", "Interactive"],
  ["pdf", "PDF"],
] as const;

type PageProps = {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Feedback({ success, error }: { success?: string; error?: string }) {
  if (success) {
    return <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div>;
  }
  if (error) {
    return <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div>;
  }
  return null;
}

export default async function ModuleResourcesAdminPage({ params, searchParams }: PageProps) {
  await connection();
  const [{ moduleId }, query] = await Promise.all([params, searchParams]);
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
  const { data: moduleRecord, error: moduleError } = await admin
    .from("roadmap_modules")
    .select("id, module_key, roadmap_version_id, title, description, is_active")
    .eq("id", moduleId)
    .maybeSingle();

  if (moduleError) {
    console.error("Failed to load module for resource management:", moduleError);
    throw new Error("Couldn't load this roadmap module.");
  }
  if (!moduleRecord) notFound();

  const { data: version, error: versionError } = await admin
    .from("roadmap_versions")
    .select("id, version_number, status, track_id")
    .eq("id", moduleRecord.roadmap_version_id)
    .maybeSingle();
  if (versionError || !version) {
    console.error("Failed to load roadmap version:", versionError);
    throw new Error("Couldn't load the roadmap version.");
  }

  const { data: track, error: trackError } = await admin
    .from("learning_tracks")
    .select("slug")
    .eq("id", version.track_id)
    .maybeSingle();
  if (trackError || track?.slug !== "full-stack-development") notFound();

  const { data: resources, error: resourcesError } = await admin
    .from("roadmap_module_resources")
    .select("id, resource_key, title, resource_type, url, provider, description, language, duration_seconds, is_required, sort_order, is_active")
    .eq("roadmap_version_id", version.id)
    .eq("roadmap_module_id", moduleRecord.id)
    .order("sort_order", { ascending: true });

  if (resourcesError) {
    console.error("Failed to load module resources:", resourcesError);
    throw new Error("Couldn't load module resources. Make sure the module resources migration has been applied.");
  }

  const resourceList = resources ?? [];
  const canEdit = version.status === "draft" && moduleRecord.is_active;

  return (
    <main className="page-container">
      <Link href="/admin/roadmap" className="text-link inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back to Roadmap Admin
      </Link>

      <header className="page-heading mt-5">
        <span className="eyebrow">Module-wide resource management</span>
        <h1>{moduleRecord.title}</h1>
        <p>{moduleRecord.module_key} · Draft version {version.version_number}</p>
        <p className="stat-note mt-2">These resources are shared references for the entire module. They are separate from the videos, articles, and exercises attached to individual lessons.</p>
      </header>

      <Feedback success={successMessage} error={errorMessage} />

      {!canEdit ? (
        <section className="panel p-5 mb-7">
          <h2 className="font-semibold">Read-only module</h2>
          <p className="stat-note mt-1">Only active modules inside a Draft version can be changed.</p>
        </section>
      ) : (
        <section className="panel p-5 mb-7">
          <h2 className="text-xl font-semibold">Add a general module resource</h2>
          <p className="stat-note mt-1">Use this for full-module courses, reference guides, cheat sheets, and other materials that are useful across multiple topics.</p>
          <form action={createModuleResourceAction} className="admin-form-grid mt-5">
            <input type="hidden" name="versionId" value={version.id} />
            <input type="hidden" name="moduleId" value={moduleRecord.id} />

            <label className="admin-field">
              <span>Resource key</span>
              <input name="resourceKey" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. javascript-complete-guide" />
            </label>
            <label className="admin-field">
              <span>Title</span>
              <input name="title" required placeholder="e.g. Complete JavaScript Guide" />
            </label>
            <label className="admin-field">
              <span>Resource type</span>
              <select name="resourceType" defaultValue="documentation" required>
                {RESOURCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Language</span>
              <select name="language" defaultValue="en" required>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="admin-field admin-field-wide">
              <span>URL</span>
              <input name="url" type="url" required placeholder="https://..." />
            </label>
            <label className="admin-field">
              <span>Provider</span>
              <input name="provider" placeholder="e.g. MDN, YouTube, freeCodeCamp" />
            </label>
            <label className="admin-field">
              <span>Duration in seconds (optional)</span>
              <input name="durationSeconds" type="number" min="0" placeholder="Leave empty if unknown" />
            </label>
            <label className="admin-field">
              <span>Display order</span>
              <input name="sortOrder" type="number" min="1" defaultValue={resourceList.length + 1} required />
            </label>
            <label className="admin-field admin-field-wide">
              <span>Description</span>
              <textarea name="description" rows={2} placeholder="What does this resource help the student with?" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isRequired" defaultChecked /> Required resource
            </label>
            <button type="submit" className="button-primary admin-submit"><Plus size={16} /> Add Module Resource</button>
          </form>
        </section>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">General module resources</h2>
        <span className="stat-note">{resourceList.length} resources</span>
      </div>

      <div className="space-y-4">
        {resourceList.map((resource) => (
          <article key={resource.id} className="panel p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">{resource.resource_type} · {resource.language} · Order {resource.sort_order}</p>
                <h3 className="font-semibold">{resource.title}</h3>
                {resource.description ? <p className="stat-note mt-1">{resource.description}</p> : null}
                <p className="stat-note mt-1 break-all">{resource.url}</p>
                <Link href={resource.url} target="_blank" rel="noreferrer" className="text-link inline-flex items-center gap-1 mt-1">
                  Open resource <ExternalLink size={13} />
                </Link>
                <p className="stat-note mt-1">{resource.provider || "Provider not specified"} · {resource.is_required ? "Required" : "Optional"}{resource.duration_seconds !== null ? ` · ${resource.duration_seconds}s` : ""}</p>
              </div>
              <span className={`topic-status-badge ${resource.is_active ? "screening_passed" : "self_reported_unknown"}`}>
                {resource.is_active ? "Active" : "Archived"}
              </span>
            </div>

            {canEdit && resource.is_active ? (
              <>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">Edit resource</summary>
                  <form action={updateModuleResourceAction} className="admin-form-grid mt-4">
                    <input type="hidden" name="versionId" value={version.id} />
                    <input type="hidden" name="moduleId" value={moduleRecord.id} />
                    <input type="hidden" name="resourceId" value={resource.id} />
                    <label className="admin-field"><span>Resource key</span><input name="resourceKey" required defaultValue={resource.resource_key} /></label>
                    <label className="admin-field"><span>Title</span><input name="title" required defaultValue={resource.title} /></label>
                    <label className="admin-field"><span>Resource type</span>
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
                    <label className="admin-field"><span>Provider</span><input name="provider" defaultValue={resource.provider} /></label>
                    <label className="admin-field"><span>Duration in seconds</span><input name="durationSeconds" type="number" min="0" defaultValue={resource.duration_seconds ?? ""} /></label>
                    <label className="admin-field"><span>Display order</span><input name="sortOrder" type="number" min="1" required defaultValue={resource.sort_order} /></label>
                    <label className="admin-field admin-field-wide"><span>Description</span><textarea name="description" rows={2} defaultValue={resource.description} /></label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isRequired" defaultChecked={resource.is_required} /> Required resource</label>
                    <button type="submit" className="button-primary admin-submit"><Save size={16} /> Save Resource</button>
                  </form>
                </details>
                <form action={archiveModuleResourceAction} className="mt-3">
                  <input type="hidden" name="versionId" value={version.id} />
                  <input type="hidden" name="moduleId" value={moduleRecord.id} />
                  <input type="hidden" name="resourceId" value={resource.id} />
                  <button type="submit" className="button-secondary">Archive resource</button>
                </form>
              </>
            ) : null}
          </article>
        ))}
        {resourceList.length === 0 ? <section className="panel p-5 stat-note">No general resources have been added to this module yet.</section> : null}
      </div>

      <section className="panel p-5 mt-7">
        <h2 className="font-semibold">How to use these resources</h2>
        <p className="stat-note mt-2">Keep full courses, module-wide documentation, and broad reference materials here. Put a specific video, article, or exercise that teaches one lesson inside that lesson&apos;s own Resources section.</p>
        <p className="stat-note mt-2">These resources belong to Draft version {version.version_number}. Students will not see them until this roadmap version is published.</p>
      </section>
    </main>
  );
}
