import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock3 } from "lucide-react";
import { curriculum } from "@/lib/curriculum";

export type ModuleTopicSummary = {
  total: number;
  screeningPassed: number;
  needsReview: number;
  needsLearning: number;
  notAssessed: number;
};

type Props = {
  topicSummaries: Record<string, ModuleTopicSummary>;
};

export default function RoadmapClient({ topicSummaries }: Props) {
  const totals = Object.values(topicSummaries).reduce(
    (acc, item) => ({
      total: acc.total + item.total,
      screeningPassed: acc.screeningPassed + item.screeningPassed,
      needsReview: acc.needsReview + item.needsReview,
      needsLearning: acc.needsLearning + item.needsLearning,
      notAssessed: acc.notAssessed + item.notAssessed,
    }),
    { total: 0, screeningPassed: 0, needsReview: 0, needsLearning: 0, notAssessed: 0 },
  );

  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">Your learning path</span>
        <h1>The Full-Stack Roadmap</h1>
        <p>
          Explore the complete roadmap. Your progress is tracked at topic level,
          so you can focus on the specific concepts you still need to learn.
        </p>
      </div>

      <section className="roadmap-overview">
        <div>
          <h2>Your topic progress</h2>
          <p>{totals.total} topics across {curriculum.length} provisional modules</p>
        </div>
        <div className="module-meta" style={{ flexWrap: "wrap" }}>
          <span className="status-pill completed">
            <CheckCircle2 size={13} /> {totals.screeningPassed} screening passed
          </span>
          <span className="status-pill current">{totals.needsReview} needs review</span>
          <span className="status-pill locked">{totals.needsLearning} to learn</span>
          <span className="status-pill">{totals.notAssessed} not assessed</span>
        </div>
      </section>

      <div className="module-list roadmap-track">
        {curriculum.map((item) => {
          const summary = topicSummaries[item.id] ?? {
            total: 0,
            screeningPassed: 0,
            needsReview: 0,
            needsLearning: 0,
            notAssessed: 0,
          };

          return (
            <article className="roadmap-card" key={item.id}>
              <Link
                href={`/roadmap/${item.id}`}
                className="module-card"
                aria-label={`Explore module ${item.number}: ${item.title}`}
              >
                <div className="module-number">{item.number}</div>

                <div className="module-content">
                  <div className="module-meta" style={{ marginBottom: 7 }}>
                    <span className="status-pill">
                      <BookOpen size={13} /> {summary.total} topics
                    </span>
                    <span>
                      <Clock3 size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {item.duration}
                    </span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="module-meta">
                    {item.skills.map((skill) => <span key={skill}>{skill}</span>)}
                  </div>

                  <p className="stat-note" style={{ marginTop: 9 }}>
                    {summary.screeningPassed} passed · {summary.needsReview} review · {summary.needsLearning} to learn · {summary.notAssessed} not assessed
                  </p>
                </div>

                <ArrowRight size={19} color="#858ba0" />
              </Link>
            </article>
          );
        })}
      </div>

      <p className="stat-note" style={{ marginTop: 20 }}>
        “Screening passed” is an initial knowledge signal, not a mastery certificate.
        Learning topics and question banks are provisional and can be managed by the Masarak admin team.
      </p>
    </div>
  );
}
