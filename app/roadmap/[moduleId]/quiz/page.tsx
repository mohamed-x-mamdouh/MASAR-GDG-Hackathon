
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import QuizClient from "@/components/quiz-client";
import {
  curriculum,
  getModuleById,
} from "@/lib/curriculum";
import { getQuizByModuleId } from "@/lib/quizzes";

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
  const { moduleId } = await params;

  const item = getModuleById(moduleId);
  const quiz = getQuizByModuleId(moduleId);

  if (!item || !quiz) {
    notFound();
  }

  return (
    <QuizClient
      moduleId={item.id}
      moduleTitle={item.title}
      quiz={quiz}
    />
  );
}
