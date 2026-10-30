import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";
import { archiveTopicAction, archiveTopicQuestionAction, createTopicQuestionAction, updateTopicDetailsAction } from "@/app/admin/actions";

type Props = { params: Promise<{ topicId: string }> };

export default async function AdminTopicPage({ params }: Props) {
  await connection();
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: topic }, { data: questions }] = await Promise.all([
    admin.from("learning_topics").select("id, module_id, title, description, sort_order, is_active").eq("id", topicId).maybeSingle(),
    admin.from("topic_assessment_questions").select("id, prompt, question_type, difficulty, options, correct_option_id, explanation, version, is_active, created_at").eq("topic_id", topicId).order("created_at", { ascending: false }),
  ]);
  if (!topic) notFound();
  const moduleTitle = curriculum.find((item) => item.id === topic.module_id)?.title ?? topic.module_id;
  const activeCount = (questions ?? []).filter((item) => item.is_active).length;

  return (
    <div className="page-container">
      <Link href="/admin" className="text-link inline-flex items-center gap-2"><ArrowLeft size={16} /> Back to Admin</Link>
      <div className="page-heading mt-5">
        <span className="eyebrow">{moduleTitle}</span>
        <h1>{topic.title}</h1>
        <p>{topic.description}</p>
        <p className="stat-note">{activeCount} active questions. Student assessments require at least 2 active questions per topic.</p>
      </div>

      <section className="panel p-6 mb-5">
        <h2 className="text-xl font-semibold">Edit topic details</h2>
        <form action={updateTopicDetailsAction} className="admin-form-grid mt-4">
          <input type="hidden" name="topicId" value={topicId} />
          <label className="admin-field"><span>Topic title</span><input name="title" required defaultValue={topic.title} /></label>
          <label className="admin-field"><span>Sort order</span><input name="sortOrder" type="number" min="0" defaultValue={topic.sort_order} /></label>
          <label className="admin-field admin-field-wide"><span>Description</span><textarea name="description" rows={2} defaultValue={topic.description ?? ""} /></label>
          <button className="button-primary admin-submit" type="submit">Save topic details</button>
        </form>
      </section>

      <section className="panel p-6">
        <h2 className="text-xl font-semibold">Add a question</h2>
        <p className="stat-note mt-1">Published questions are kept as historical versions. To replace one, archive it and add a new question.</p>
        <form action={createTopicQuestionAction} className="admin-form-grid mt-5">
          <input type="hidden" name="topicId" value={topicId} />
          <label className="admin-field admin-field-wide">
            <span>Question text</span>
            <textarea name="prompt" rows={3} required placeholder="Write a clear question that measures this topic." />
          </label>
          <label className="admin-field">
            <span>Question type</span>
            <select name="questionType" defaultValue="knowledge"><option value="knowledge">Knowledge</option><option value="scenario">Scenario</option></select>
          </label>
          <label className="admin-field">
            <span>Difficulty</span>
            <select name="difficulty" defaultValue="medium"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
          </label>
          <label className="admin-field">
            <span>Option A</span>
            <input name="optionA" required />
          </label>
          <label className="admin-field">
            <span>Option B</span>
            <input name="optionB" required />
          </label>
          <label className="admin-field">
            <span>Option C</span>
            <input name="optionC" required />
          </label>
          <label className="admin-field">
            <span>Correct option</span>
            <select name="correctOptionId" defaultValue="a"><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>
          </label>
          <label className="admin-field admin-field-wide">
            <span>Explanation shown after submission</span>
            <textarea name="explanation" rows={2} placeholder="Explain why the correct answer is right." />
          </label>
          <button className="button-primary admin-submit" type="submit"><Plus size={17} /> Publish question</button>
        </form>
      </section>

      <section className="mt-7">
        <h2 className="mb-4 text-xl font-bold">Question versions</h2>
        <div className="space-y-3">
          {(questions ?? []).map((question) => (
            <article className="panel p-5" key={question.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="topic-status-badge screening_passed">Version {question.version}</span>
                    <span className="topic-status-badge needs_review">{question.difficulty}</span>
                    <span className="topic-status-badge self_reported_unknown">{question.question_type}</span>
                    <span className={`topic-status-badge ${question.is_active ? "screening_passed" : "self_reported_unknown"}`}>{question.is_active ? "Active" : "Archived"}</span>
                  </div>
                  <h3 className="font-semibold">{question.prompt}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    {(Array.isArray(question.options) ? question.options : []).map((option: {id:string;label:string}) => (
                      <p key={option.id}><strong>{option.id.toUpperCase()}.</strong> {option.label} {question.correct_option_id === option.id ? "✓ Correct" : ""}</p>
                    ))}
                  </div>
                  {question.explanation && <p className="stat-note mt-2">{question.explanation}</p>}
                </div>
                {question.is_active && (
                  <form action={archiveTopicQuestionAction}>
                    <input type="hidden" name="topicId" value={topicId} />
                    <input type="hidden" name="questionId" value={question.id} />
                    <button className="button-secondary" type="submit">Archive</button>
                  </form>
                )}
              </div>
            </article>
          ))}
          {(!questions || questions.length === 0) && <p className="panel p-5 stat-note">No questions added for this topic yet.</p>}
        </div>
      </section>

      {topic.is_active && (
        <form action={archiveTopicAction} className="mt-8">
          <input type="hidden" name="topicId" value={topicId} />
          <button type="submit" className="button-secondary">Archive this topic</button>
        </form>
      )}
    </div>
  );
}
