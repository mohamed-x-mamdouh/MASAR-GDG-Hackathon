import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, FileText, Route } from "lucide-react";
import { Card } from "@heroui/react";

export default function DashboardClient() {
  return (
    <div className="page-container">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">Student workspace</span>
          <h1>Your journey, at a glance.</h1>
          <p>
            Focus on the exact topics you need to learn. Your assessment results
            are saved to your profile and reflected in the roadmap.
          </p>
        </div>
        <div className="dashboard-actions">
          <Link href="/roadmap" className="button-primary">
            Open roadmap <ArrowRight size={17} />
          </Link>
          <Link href="/onboarding/assessment" className="button-secondary">
            <ClipboardCheck size={17} /> Assess my skills
          </Link>
          <Link href="/profile/assessment" className="button-secondary">
            <FileText size={17} /> View latest report
          </Link>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 mt-7">
        <Card className="panel p-6">
          <div className="feature-icon"><Route size={22} /></div>
          <h2 className="mt-4 text-xl font-semibold">Your personalized roadmap</h2>
          <p className="mt-2 text-gray-500">
            Explore the full roadmap and open any module to see your topic-by-topic
            status. Topics that need work remain visible without sending you back
            to the beginning of an entire module.
          </p>
          <Link href="/roadmap" className="button-primary mt-5">
            Explore roadmap <ArrowRight size={17} />
          </Link>
        </Card>

        <Card className="panel p-6">
          <div className="feature-icon"><BookOpen size={22} /></div>
          <h2 className="mt-4 text-xl font-semibold">Keep your skill profile updated</h2>
          <p className="mt-2 text-gray-500">
            Assess a few topics at a time. You do not need to answer questions
            about the entire Full-Stack track in one sitting. You can return and
            assess more topics whenever you are ready.
          </p>
          <Link href="/onboarding/assessment" className="button-primary mt-5">
            Assess more topics <ArrowRight size={17} />
          </Link>
        </Card>
      </div>

      <p className="stat-note mt-6">
        A “Screening passed” result is an initial knowledge signal, not a
        certification or proof of complete practical mastery. Your results and
        previous attempts remain available from your profile.
      </p>
    </div>
  );
}
