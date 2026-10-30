import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";
import { createTopicAction } from "@/app/admin/actions";

export default async function AdminPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: topics, error: topicsError }, { data: questions, error: questionsError }] = await Promise.all([
    admin.from("learning_topics").select("id, module_id, slug, title, description, sort_order, is_active").order("module_id").order("sort_order"),
    admin.from("topic_assessment_questions").select("topic_id, is_active"),
  ]);
  if (topicsError) console.error("Admin topics query failed:", topicsError);
  if (questionsError) console.error("Admin question count query failed:", questionsError);

  const activeQuestionCounts = new Map<string, number>();
  for (const question of questions ?? []) {
    if (question.is_active) {
      activeQuestionCounts.set(question.topic_id, (activeQuestionCounts.get(question.topic_id) ?? 0) + 1);
    }
  }
  const moduleTitles = new Map(curriculum.map((item) => [item.id, item.title]));

  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow"><Settings2 size={15} /> Content management</span>
        <h1>Assessment Admin</h1>
        <p>Manage the topic map and the question bank used by student placement assessments.</p>
      </div>

      <section className="panel p-6">
        <h2 className="text-xl font-semibold">Add a topic</h2>
        <p className="stat-note mt-1">Topics are small, assessable units inside a roadmap module.</p>
        <form action={createTopicAction} className="admin-form-grid mt-5">
          <label className="admin-field">
            <span>Roadmap module</span>
            <select name="moduleId" required defaultValue="">
              <option value="" disabled>Select a module</option>
              {curriculum.map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span>Topic title</span>
            <input name="title" required placeholder="e.g. CSS Positioning" />
          </label>
          <label className="admin-field">
            <span>Slug (unique in module)</span>
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="css-positioning" />
          </label>
          <label className="admin-field">
            <span>Sort order</span>
            <input name="sortOrder" type="number" min="0" defaultValue="1" />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Description</span>
            <textarea name="description" rows={2} placeholder="What exactly does this topic cover?" />
          </label>
          <button className="button-primary admin-submit" type="submit"><Plus size={17} /> Add topic</button>
        </form>
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Topics and question bank</h2>
          <span className="stat-note">{topics?.length ?? 0} topics</span>
        </div>
        <div className="space-y-3">
          {(topics ?? []).map((topic) => {
            const count = activeQuestionCounts.get(topic.id) ?? 0;
            return (
              <article className="panel p-4" key={topic.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{moduleTitles.get(topic.module_id) ?? topic.module_id}</p>
                    <h3 className="font-semibold">{topic.title}</h3>
                    <p className="stat-note">{topic.description || topic.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`topic-status-badge ${!topic.is_active ? "self_reported_unknown" : count >= 2 ? "screening_passed" : "needs_review"}`}>
                      {!topic.is_active ? "Archived" : `${count} active questions`}
                    </span>
                    <Link className="button-secondary" href={`/admin/topics/${topic.id}`}>Manage</Link>
                  </div>
                </div>
              </article>
            );
          })}
          {(!topics || topics.length === 0) && <p className="panel p-5 stat-note">No topics yet. Add your first topic above.</p>}
        </div>
      </section>
    </div>
  );
}
