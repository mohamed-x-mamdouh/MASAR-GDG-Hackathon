import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import QuizClient from "@/components/quiz-client";
import { curriculum, getModuleById } from "@/lib/curriculum";
import { getQuizByModuleId } from "@/lib/quizzes";
import { getModuleAccess } from "@/lib/module-access";
import type { PublicModuleQuiz } from "@/lib/quiz-types";

type Props = {
  params: Promise<{ moduleId: string }>;
};

export function generateStaticParams() {
  return curriculum.map((roadmapModule) => ({
    moduleId: roadmapModule.id,
  }));
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { moduleId } = await params;
  const item = getModuleById(moduleId);

  return {
    title: item ? `${item.title} Quiz` : "Quiz not found",
  };
}

export default async function QuizPage({ params }: Props) {
  await connection();

  const { moduleId } = await params;

  const item = getModuleById(moduleId);
  const quiz = getQuizByModuleId(moduleId);

  if (!item || !quiz) {
    notFound();
  }

  const access = await getModuleAccess(moduleId);

  if (!access.authenticated) {
    redirect("/login");
  }

  if (!access.allowed) {
    return (
      <div className="page-container quiz-page">
        <Link href="/roadmap" className="text-link">
          <ArrowLeft size={16} /> Back to roadmap
        </Link>

        <section className="panel quiz-result">
          <LockKeyhole size={38} />

          <h1>This quiz is locked</h1>

          <p>
            Complete the prerequisite stages by passing their quizzes
            before starting this one.
          </p>

          <Link href="/roadmap" className="button-primary">
            View prerequisites
            <ArrowLeft size={17} />
          </Link>
        </section>
      </div>
    );
  }

  // Only public question data is sent to the browser.
  // Correct answers and explanations stay on the server.
  const publicQuiz: PublicModuleQuiz = {
    moduleId: quiz.moduleId,
    title: quiz.title,
    passPercentage: quiz.passPercentage,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
    })),
  };

  return (
    <QuizClient
      moduleId={item.id}
      moduleTitle={item.title}
      quiz={publicQuiz}
    />
  );
}