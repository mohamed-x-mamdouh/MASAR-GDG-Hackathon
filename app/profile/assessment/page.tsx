import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curriculum } from "@/lib/curriculum";

export default async function SavedAssessmentReportPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("latest_topic_assessment_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load latest assessment pointer:", profileError);
  }
  if (!profile?.latest_topic_assessment_id) {
    return (
      <div className="page-container">
        <Link href="/profile" className="text-link inline-flex items-center gap-2"><ArrowLeft size={16} /> My profile</Link>
        <section className="panel mt-5 p-6">
          <h1 className="text-2xl font-bold">No assessment report yet</h1>
          <p className="stat-note mt-2">Complete a topic assessment and your latest report will appear here.</p>
          <Link href="/onboarding/assessment" className="button-primary mt-5">Assess my skills</Link>
        </section>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: attempt, error } = await admin
    .from("topic_assessment_attempts")
    .select("id, score, total_questions, correct_answers, completed_at, report, status")
    .eq("id", profile.latest_topic_assessment_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) console.error("Failed to load assessment report:", error);
  if (!attempt || attempt.status !== "completed" || !attempt.report) {
    return (
      <div className="page-container">
        <Link href="/profile" className="text-link inline-flex items-center gap-2"><ArrowLeft size={16} /> My profile</Link>
        <section className="panel mt-5 p-6"><h1 className="text-2xl font-bold">Report unavailable</h1><p className="stat-note mt-2">We couldn&apos;t find a completed report for this account.</p></section>
      </div>
    );
  }

  const moduleTitles = new Map(curriculum.map((module) => [module.id, module.title]));
  const report = attempt.report as {
    topics?: Array<{topicId:string;topicTitle:string;moduleId:string;selfAssessment:string;status:string;score:number|null;correctCount:number;questionCount:number;confidence:string|null}>;
    questions?: Array<{questionId:string;prompt:string;selectedAnswer:string;correctAnswer:string;isCorrect:boolean;explanation:string}>;
    score?: number | null;
    correctCount?: number;
    questionCount?: number;
  };

  const nextTopic = (report.topics ?? []).find((topic) => topic.status !== "screening_passed");

  return (
    <div className="page-container">
      <Link href="/profile" className="text-link inline-flex items-center gap-2"><ArrowLeft size={16} /> My profile</Link>
      <header className="page-heading mt-5">
        <span className="eyebrow">Saved assessment report</span>
        <h1>Your skill assessment</h1>
        <p>{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : "Completed assessment"}</p>
      </header>

      <section className="panel p-6">
        <div className="flex items-center gap-3"><CheckCircle2 size={30} className="text-emerald-600"/><div><h2 className="text-xl font-bold">Assessment completed</h2><p className="stat-note">Saved to your Masarak profile</p></div></div>
        <div className="topic-report-summary">
          <div><strong>{attempt.total_questions}</strong><span>Questions</span></div>
          <div><strong>{attempt.score === null ? "—" : `${attempt.score}%`}</strong><span>Score</span></div>
          <div><strong>{attempt.correct_answers}</strong><span>Correct</span></div>
        </div>
      </section>

      <section className="panel mt-5 p-6">
        <h2 className="text-xl font-semibold">Your topic results</h2>
        <div className="mt-4 space-y-3">
          {(report.topics ?? []).map((topic) => (
            <article className="topic-result-row" key={topic.topicId}>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500">{moduleTitles.get(topic.moduleId) ?? topic.moduleId}</p><h3 className="font-semibold">{topic.topicTitle}</h3>
                <p className="stat-note">{topic.score === null ? "Not tested — marked as not known" : `${topic.correctCount}/${topic.questionCount} correct`}</p>
              </div>
              <span className={`topic-status-badge ${topic.status}`}>
                {topic.status === "screening_passed" ? "Screening passed" : topic.status === "needs_review" ? "Needs review" : topic.status === "needs_learning" ? "Start learning" : "Not assessed"}
              </span>
            </article>
          ))}
        </div>
      </section>

      {(report.questions ?? []).length > 0 && (
        <section className="panel mt-5 p-6">
          <h2 className="text-xl font-semibold">Question feedback</h2>
          <div className="mt-4 space-y-4">
            {(report.questions ?? []).map((question, index) => (
              <article className="topic-answer-review" key={question.questionId}>
                <h3 className="font-semibold">{index + 1}. {question.prompt}</h3>
                <p className="mt-1 text-sm">Your answer: {question.selectedAnswer}</p>
                {!question.isCorrect && <p className="text-sm">Correct answer: {question.correctAnswer}</p>}
                {question.explanation && <p className="stat-note mt-1">{question.explanation}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="dashboard-actions mt-5">
        {nextTopic ? (
          <Link href={`/roadmap/${nextTopic.moduleId}#topic-${nextTopic.topicId}`} className="button-primary">Start with {nextTopic.topicTitle}</Link>
        ) : (
          <Link href="/roadmap" className="button-primary">Review your roadmap</Link>
        )}
        <Link href="/roadmap" className="button-secondary">Open your roadmap</Link>
        <Link href="/onboarding/assessment" className="button-secondary">Assess more topics</Link>
      </div>
    </div>
  );
}
