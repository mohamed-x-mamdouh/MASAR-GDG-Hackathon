
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  LockKeyhole,
  Route,
  Target,
} from "lucide-react";

const features = [
  {
    icon: Route,
    title: "See the whole journey",
    description:
      "Understand how the stages connect, what comes first, and how each skill supports the next.",
  },
  {
    icon: Target,
    title: "Know your next step",
    description:
      "Replace scattered tutorials with a clear learning path, practical tasks, and defined goals.",
  },
  {
    icon: CheckCircle2,
    title: "Build proof of your skills",
    description:
      "Move beyond watching videos toward practical work that demonstrates what you can do.",
  },
];

const previewStages = [
  { title: "Web Fundamentals", state: "completed" },
  { title: "HTML & CSS", state: "completed" },
  { title: "JavaScript", state: "current" },
  { title: "React", state: "locked" },
];

export default function HomePage() {
  return (
    <div className="page-container">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              Your journey starts here
            </span>

            <h1>
              Stop guessing.
              <br />
              Start building
              <br />
              <span className="text-accent">your future.</span>
            </h1>

            <p className="hero-copy">
              A clearer path to becoming a Full-Stack Developer.
              Know what to learn, why it matters, and what to do next —
              one meaningful step at a time.
            </p>

            <div className="hero-actions">
              <Link href="/roadmap" className="button-primary">
                Explore the roadmap <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard" className="button-secondary">
                View dashboard
              </Link>
            </div>

            <div className="hero-note">
              <CheckCircle2 size={17} />
              Structured learning. Practical work. Visible progress.
            </div>
          </div>

          <div className="preview-card">
            <div className="preview-top">
              <div>
                <div className="preview-title">Your learning path</div>
                <div className="stat-note">Full-Stack Development</div>
              </div>
              <span className="preview-label">DEMO</span>
            </div>

            <div className="preview-title">Your progress</div>
            <div className="preview-progress">
              <span style={{ width: "20%" }} />
            </div>
            <div className="preview-stat">
              <span>2 of 10 stages</span>
              <strong>20%</strong>
            </div>

            <div className="module-list" style={{ marginTop: 22 }}>
              {previewStages.map((stage) => (
                <div className="preview-step" key={stage.title}>
                  <div className="step-icon">
                    {stage.state === "completed" ? (
                      <CheckCircle2 size={20} />
                    ) : stage.state === "current" ? (
                      <Compass size={20} />
                    ) : (
                      <LockKeyhole size={18} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3>{stage.title}</h3>
                    <p>
                      {stage.state === "completed"
                        ? "Completed"
                        : stage.state === "current"
                          ? "Your next learning stage"
                          : "Prerequisites required"}
                    </p>
                  </div>
                  {stage.state === "current" && (
                    <ArrowUpRight size={17} color="#5b4ce2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">A better way to learn</span>
          <h2>Clarity is the first step to progress.</h2>
          <p>
            The problem is not always a lack of resources. Sometimes it is
            not knowing which resource matters, how topics connect, or how
            to tell whether you are actually improving.
          </p>
        </div>

        <div className="feature-grid">
          {features.map(({ icon: Icon, title, description }) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="bottom-cta">
          <div>
            <h2>Your next step should never be a mystery.</h2>
            <p>
              Explore the complete Full-Stack journey and see what lies ahead.
            </p>
          </div>
          <Link href="/roadmap" className="button-primary">
            View the roadmap <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
