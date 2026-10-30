export type PublicQuizQuestion = {
  id: string;
  prompt: string;
  options: {
    id: string;
    label: string;
  }[];
};

export type PublicModuleQuiz = {
  moduleId: string;
  title: string;
  passPercentage: number;
  questions: PublicQuizQuestion[];
};

export type QuizReviewItem = {
  questionId: string;
  correctOptionId: string;
  explanation: string;
};