import Link from "next/link";
import { Card } from "@heroui/react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Route,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

const features = [
  {
    icon: Route,
    title: "See how the journey connects",
    description:
      "Understand how learning stages build on each other instead of jumping between unrelated tutorials.",
  },
  {
    icon: Target,
    title: "Know your next step",
    description:
      "Use your goals and current knowledge to decide what deserves your attention next.",
  },
  {
    icon: CheckCircle2,
    title: "Make progress you can verify",
    description:
      "Move from learning materials to practical work and knowledge checks that help you see what you understand.",
  },
];

const journeySteps = [
  {
    icon: Compass,
    number: "01",
    title: "Choose your direction",
    description:
      "Tell Masarak how you want to begin.",
  },
  {
    icon: ClipboardCheck,
    number: "02",
    title: "Check your current skills",
    description:
      "Start fresh or take an initial knowledge assessment.",
  },
  {
    icon: Route,
    number: "03",
    title: "Get your next steps",
    description:
      "Follow a path and focus on what comes next.",
  },
];

export default async function HomePage() {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasChosenStartPath = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_start_path")
      .eq("id", user.id)
      .maybeSingle();

    hasChosenStartPath = Boolean(
      profile?.selected_start_path,
    );
  }

  const primaryHref = !user
    ? "/signup"
    : hasChosenStartPath
      ? "/dashboard"
      : "/onboarding";

  const primaryLabel = !user
    ? "Create your account"
    : hasChosenStartPath
      ? "Continue learning"
      : "Choose your starting point";

  const assessmentHref = user
    ? "/onboarding/assessment"
    : "/signup";

  const assessmentLabel = user
    ? "Take skill assessment"
    : "Create an account to assess skills";

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
              <span className="text-accent">
                your future.
              </span>
            </h1>

            <p className="hero-copy">
              A clearer way to plan your learning. Understand
              where to begin, what to focus on next, and how
              to turn knowledge into practical skills — one
              meaningful step at a time.
            </p>

            <div className="hero-actions">
              <Link
                href={primaryHref}
                className="button-primary"
              >
                {primaryLabel}
                <ArrowRight size={17} />
              </Link>

              <Link
                href={assessmentHref}
                className="button-secondary"
              >
                <ClipboardCheck size={17} />
                {assessmentLabel}
              </Link>

              <Link
                href="/roadmap"
                className="button-secondary"
              >
                Explore roadmap
              </Link>
            </div>

            <div className="hero-note">
              <CheckCircle2 size={17} />
              A clearer plan. Practical work. Visible progress.
            </div>
          </div>

          <Card className="preview-card">
            <Card.Header className="preview-top">
              <div>
                <Card.Title className="preview-title">
                  A path built around you
                </Card.Title>

                <Card.Description className="stat-note">
                  From first step to next milestone
                </Card.Description>
              </div>

              <span className="preview-label">
                HOW IT WORKS
              </span>
            </Card.Header>

            <Card.Content className="module-list path-preview-list">
              {journeySteps.map(
                ({
                  icon: Icon,
                  number,
                  title,
                  description,
                }) => (
                  <div
                    className="preview-step"
                    key={number}
                  >
                    <div className="step-icon">
                      <Icon size={20} />
                    </div>

                    <div className="path-preview-copy">
                      <span className="path-step-number">
                        STEP {number}
                      </span>

                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                ),
              )}
            </Card.Content>

            <Card.Footer className="path-preview-note">
              The roadmap and assessment are provisional.
              Their learning content will be customized for
              Masarak.
            </Card.Footer>
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">
            A better way to learn
          </span>

          <h2>
            Clarity is the first step to progress.
          </h2>

          <p>
            The problem is not always a lack of resources.
            Sometimes it is not knowing which resource matters,
            how topics connect, or how to tell whether you are
            actually improving.
          </p>
        </div>

        <div className="feature-grid">
          {features.map(
            ({ icon: Icon, title, description }) => (
              <article
                className="feature-card"
                key={title}
              >
                <div className="feature-icon">
                  <Icon size={22} />
                </div>

                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="section">
        <div className="bottom-cta">
          <div>
            <h2>
              Your next step should never be a mystery.
            </h2>

            <p>
              Start with your goals, check what you already
              know, and build a learning path you can keep
              refining.
            </p>
          </div>

          <Link
            href={primaryHref}
            className="button-primary"
          >
            {primaryLabel}
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}