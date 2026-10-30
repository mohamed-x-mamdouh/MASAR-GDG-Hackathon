"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import {
  startTopicAssessmentAction,
  submitTopicAssessmentAction,
  type TopicAssessmentReport,
  type TopicSelectionInput,
  type PublicAssessmentQuestion,
} from "@/app/onboarding/assessment/actions";

type TopicItem = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  description: string;
  questionCount: number;
};

type Choice = TopicSelectionInput["selfAssessment"];

type Props = { topics: TopicItem[] };

const choiceLabels: Record<Choice, string> = {
  know: "I know this",
  unknown: "I don't know this",
  unsure: "I'm not sure",
};

export default function TopicAssessmentClient({ topics }: Props) {
  const [selections, setSelections] = useState<Record<string, Choice>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicAssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [report, setReport] = useState<TopicAssessmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedTopics = useMemo(() => {
    const groups = new Map<string, TopicItem[]>();
    for (const topic of topics) {
      const items = groups.get(topic.moduleId) ?? [];
      items.push(topic);
      groups.set(topic.moduleId, items);
    }
    return [...groups.entries()].map(([moduleId, items]) => ({
      moduleId,
      moduleTitle: items[0]?.moduleTitle ?? moduleId,
      topics: items,
    }));
  }, [topics]);

  const selectedTopics = Object.entries(selections).map(([topicId, selfAssessment]) => ({
    topicId,
    selfAssessment,
  }));
  const testedTopicsCount = selectedTopics.filter(
    (item) => item.selfAssessment !== "unknown",
  ).length;

  async function beginAssessment() {
    if (selectedTopics.length === 0) {
      setError("Choose at least one topic before continuing.");
      return;
    }
    if (testedTopicsCount > 6) {
      setError("Choose up to 6 topics to test in one session. You can assess more later.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await startTopicAssessmentAction(selectedTopics);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAttemptId(result.attemptId);
      setQuestions(result.questions);
      setAnswers({});
    } catch {
      setError("We couldn't prepare your assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAssessment() {
    if (!attemptId || loading) return;
    if (questions.some((question) => !answers[question.id])) {
      setError("Answer every question before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await submitTopicAssessmentAction(attemptId, answers);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReport(result.report);
    } catch {
      setError("We couldn't save your assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetAssessment() {
    setSelections({});
    setAttemptId(null);
    setQuestions([]);
    setAnswers({});
    setReport(null);
    setError(null);
  }

  if (report) {
    const passed = report.topics.filter((topic) => topic.status === "screening_passed").length;
    const needsLearning = report.topics.filter(
      (topic) => topic.status === "needs_learning" || topic.status === "self_reported_unknown",
    ).length;
    const needsReview = report.topics.filter((topic) => topic.status === "needs_review").length;
    const nextTopic = report.topics.find((topic) => topic.status !== "screening_passed");

    return (
      <div className="topic-assessment-result">
        <section className="panel p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={32} className="text-emerald-600" />
            <div>
              <h2 className="text-2xl font-bold">Your assessment report</h2>
              <p className="stat-note">Your results have been saved to your profile.</p>
            </div>
          </div>
          <div className="topic-report-summary">
            <div><strong>{report.questionCount}</strong><span>Questions</span></div>
            <div><strong>{report.score === null ? "—" : `${report.score}%`}</strong><span>Screening score</span></div>
            <div><strong>{passed}</strong><span>Screening passed</span></div>
            <div><strong>{needsLearning + needsReview}</strong><span>Topics to focus on</span></div>
          </div>
          <p className="stat-note">
            A screening pass means you answered the selected questions correctly.
            It is an initial signal, not a professional certification or proof of
            complete mastery.
          </p>
        </section>

        <section className="panel p-6">
          <h3 className="text-xl font-semibold">Topic-by-topic results</h3>
          <div className="mt-4 space-y-3">
            {report.topics.map((topic) => (
              <article className="topic-result-row" key={topic.topicId}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-500">{topics.find((item) => item.id === topic.topicId)?.moduleTitle ?? topic.moduleTitle}</p>
                  <h4 className="font-semibold">{topic.topicTitle}</h4>
                  <p className="stat-note">
                    {topic.status === "screening_passed"
                      ? `${topic.correctCount}/${topic.questionCount} correct · You can move past the introductory material for now.`
                      : topic.status === "needs_review"
                        ? `${topic.correctCount}/${topic.questionCount} correct · Review this topic and practice before moving on.`
                        : topic.status === "needs_learning"
                          ? `0/${topic.questionCount} correct · Start learning this topic.`
                          : "You marked this topic as not known. Start learning here; it was not tested."}
                  </p>
                </div>
                <span className={`topic-status-badge ${topic.status}`}>
                  {topic.status === "screening_passed"
                    ? "Screening passed"
                    : topic.status === "needs_review"
                      ? "Needs review"
                      : topic.status === "needs_learning"
                        ? "Start learning"
                        : "Not assessed"}
                </span>
              </article>
            ))}
          </div>
          {needsReview > 0 && (
            <p className="mt-4 text-sm text-amber-700">
              Some results are inconclusive. We recommend reviewing these topics
              rather than treating a short quiz as a final judgment.
            </p>
          )}
        </section>

        {report.questions.length > 0 && (
          <section className="panel p-6">
            <h3 className="text-xl font-semibold">Answer review</h3>
            <div className="mt-4 space-y-4">
              {report.questions.map((question, index) => (
                <article className="topic-answer-review" key={question.questionId}>
                  <div className="flex items-start gap-2">
                    {question.isCorrect ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <CircleHelp size={18} className="text-amber-600" />
                    )}
                    <div>
                      <h4 className="font-semibold">{index + 1}. {question.prompt}</h4>
                      <p className="mt-1 text-sm">Your answer: {question.selectedAnswer}</p>
                      {!question.isCorrect && (
                        <p className="text-sm">Correct answer: {question.correctAnswer}</p>
                      )}
                      {question.explanation && (
                        <p className="stat-note mt-1">{question.explanation}</p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="dashboard-actions">
          {nextTopic ? (
            <Link href={`/roadmap/${nextTopic.moduleId}#topic-${nextTopic.topicId}`} className="button-primary">
              Start with {nextTopic.topicTitle} <ArrowRight size={17} />
            </Link>
          ) : (
            <Link href="/roadmap" className="button-primary">Review your roadmap <ArrowRight size={17} /></Link>
          )}
          <Link href="/profile/assessment" className="button-secondary">
            View saved report
          </Link>
          <Link href="/roadmap" className="button-secondary">Open roadmap</Link>
          <button type="button" className="button-secondary" onClick={resetAssessment}>
            <RotateCcw size={16} /> Assess more topics
          </button>
        </div>
      </div>
    );
  }

  if (attemptId) {
    const answeredCount = Object.keys(answers).length;
    return (
      <div className="space-y-5">
        <section className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Your selected topics</h2>
              <p className="stat-note">{answeredCount} of {questions.length} questions answered</p>
            </div>
            <button type="button" className="button-secondary" onClick={resetAssessment}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </section>
        {questions.length === 0 && (
          <section className="panel p-6">
            <h2 className="font-semibold">No quiz questions needed for this selection</h2>
            <p className="stat-note mt-1">You marked these topics as ones you do not know. Continue to save them as your learning starting points.</p>
          </section>
        )}
        {questions.map((question, index) => (
          <section className="panel p-6" key={question.id}>
            <div className="quiz-question-number">
              {question.topicTitle} · Question {index + 1} of {questions.length}
            </div>
            <h2 className="mt-2 text-lg font-semibold">{question.prompt}</h2>
            <div className="quiz-options mt-4">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`quiz-option ${selected ? "is-selected" : ""}`}
                    aria-pressed={selected}
                    disabled={loading}
                    onClick={() => {
                      setAnswers((current) => ({ ...current, [question.id]: option.id }));
                      setError(null);
                    }}
                  >
                    <span className="quiz-option-letter">{option.id.toUpperCase()}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {error && <p className="quiz-validation" role="alert">{error}</p>}
        <div className="quiz-actions">
          <span className="stat-note">Up to 12 questions per session</span>
          <button type="button" className="button-primary" onClick={submitAssessment} disabled={loading}>
            {loading ? "Saving report..." : "Submit assessment"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <BookOpen size={22} className="text-indigo-600" />
          <div>
            <h2 className="font-semibold">How this works</h2>
            <p className="stat-note mt-1">
              Choose one status for each topic you want to assess. Topics marked
              “I don&apos;t know this” will not be tested; they will be added to your
              learning recommendations. We test up to 6 selected topics per
              attempt (2 questions per topic).
            </p>
          </div>
        </div>
      </section>

      {groupedTopics.map((group) => (
        <section className="panel p-5" key={group.moduleId}>
          <div className="mb-4">
            <p className="eyebrow">Module</p>
            <h2 className="text-xl font-bold">{group.moduleTitle}</h2>
          </div>
          <div className="space-y-4">
            {group.topics.map((topic) => {
              const selected = selections[topic.id];
              const canTest = topic.questionCount >= 2;
              return (
                <article className="topic-choice-row" key={topic.id}>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{topic.title}</h3>
                    <p className="stat-note">{topic.description}</p>
                    {!canTest && (
                      <p className="mt-1 text-xs text-amber-700">
                        Assessment questions are being prepared for this topic.
                        You can still mark it as something to learn.
                      </p>
                    )}
                  </div>
                  <div className="topic-choice-buttons">
                    {(["know", "unknown", "unsure"] as Choice[]).map((choice) => (
                      <button
                        type="button"
                        key={choice}
                        className={`topic-choice-button ${selected === choice ? "selected" : ""}`}
                        disabled={loading || (choice !== "unknown" && !canTest)}
                        aria-pressed={selected === choice}
                        onClick={() => {
                          setSelections((current) => {
                            const next = { ...current };
                            if (next[topic.id] === choice) delete next[topic.id];
                            else next[topic.id] = choice;
                            return next;
                          });
                          setError(null);
                        }}
                      >
                        {choiceLabels[choice]}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {testedTopicsCount > 6 && <p className="quiz-validation" role="alert">You selected more than 6 topics to test. Keep this session to 6 topics (12 questions) and assess the rest in a later session.</p>}
      {error && <p className="quiz-validation" role="alert">{error}</p>}
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Your selection</p>
            <p className="stat-note">
              {selectedTopics.length} topics selected · {testedTopicsCount} topics to test · {testedTopicsCount * 2} questions
            </p>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={beginAssessment}
            disabled={loading || selectedTopics.length === 0 || testedTopicsCount > 6}
          >
            {loading ? "Preparing..." : "Start assessment"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </div>
      </section>
    </div>
  );
}
