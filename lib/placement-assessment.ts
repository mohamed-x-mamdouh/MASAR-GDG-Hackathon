export type PlacementOption = {
  id: string;
  label: string;
};

export type PlacementQuestion = {
  id: string;
  moduleId: string;
  prompt: string;
  options: PlacementOption[];
  correctOptionId: string;
  explanation: string;
};

export type PlacementModuleResult = {
  moduleId: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  mastered: boolean;
};

export type PlacementSubmissionResult =
  | {
      ok: true;
      overallScore: number;
      validatedModuleIds: string[];
      recommendedStartModuleId: string;
      recommendedStartModuleTitle: string;
    }
  | {
      ok: false;
      error: string;
    };

// مؤقتة: رتّب وخصص الموديولات هنا عند تعديل الـ Roadmap.
export const placementModuleIds = [
  "web-fundamentals",
  "html-css",
  "javascript",
  "git-github",
  "react",
  "node-express",
  "databases-sql",
  "auth-security",
  "testing-deployment",
] as const;

// المشروع النهائي لا يتم تجاوزه باختبار الاختيار من متعدد.
export const placementFallbackModuleId = "final-project";

// بنك أولي للتجربة، وليس المنهج التعليمي النهائي للمنصة.
export const placementQuestions: PlacementQuestion[] = [
  {
    id: "web-1",
    moduleId: "web-fundamentals",
    prompt: "What normally happens when you enter a URL in a browser?",
    options: [
      { id: "a", label: "The browser sends a request to a server." },
      { id: "b", label: "The browser automatically rewrites the website code." },
      { id: "c", label: "The browser deletes the server database." },
    ],
    correctOptionId: "a",
    explanation: "A browser requests resources from a server and processes the response.",
  },
  {
    id: "web-2",
    moduleId: "web-fundamentals",
    prompt: "What is the main role of HTTP?",
    options: [
      { id: "a", label: "To style elements on a page." },
      { id: "b", label: "To define communication between clients and servers." },
      { id: "c", label: "To store files permanently on a laptop." },
    ],
    correctOptionId: "b",
    explanation: "HTTP defines how clients and servers exchange requests and responses.",
  },
  {
    id: "html-1",
    moduleId: "html-css",
    prompt: "Why use semantic HTML elements such as <main> and <nav>?",
    options: [
      { id: "a", label: "They communicate the meaning and structure of content." },
      { id: "b", label: "They replace every CSS rule." },
      { id: "c", label: "They automatically create a database." },
    ],
    correctOptionId: "a",
    explanation: "Semantic elements improve structure and accessibility.",
  },
  {
    id: "html-2",
    moduleId: "html-css",
    prompt: "Which CSS layout is commonly used to align items in a row or column?",
    options: [
      { id: "a", label: "localStorage" },
      { id: "b", label: "Flexbox" },
      { id: "c", label: "HTTP" },
    ],
    correctOptionId: "b",
    explanation: "Flexbox is designed for one-dimensional layout and alignment.",
  },
  {
    id: "js-1",
    moduleId: "javascript",
    prompt: "What is the main difference between == and === in JavaScript?",
    options: [
      { id: "a", label: "=== compares without type coercion." },
      { id: "b", label: "=== always converts values to strings." },
      { id: "c", label: "There is no difference." },
    ],
    correctOptionId: "a",
    explanation: "Strict equality compares values without implicit type coercion.",
  },
  {
    id: "js-2",
    moduleId: "javascript",
    prompt: "What does await normally do inside an async function?",
    options: [
      { id: "a", label: "It converts every value into a string." },
      { id: "b", label: "It waits for a Promise to settle before continuing that function." },
      { id: "c", label: "It permanently stops the browser." },
    ],
    correctOptionId: "b",
    explanation: "await pauses the async function until the Promise settles.",
  },
  {
    id: "git-1",
    moduleId: "git-github",
    prompt: "What does a Git commit represent?",
    options: [
      { id: "a", label: "A snapshot of tracked changes in the repository history." },
      { id: "b", label: "A deployed website that is automatically public." },
      { id: "c", label: "A new user account in GitHub." },
    ],
    correctOptionId: "a",
    explanation: "A commit records a snapshot and metadata in the repository history.",
  },
  {
    id: "git-2",
    moduleId: "git-github",
    prompt: "What is a Git branch mainly used for?",
    options: [
      { id: "a", label: "Encrypting the database." },
      { id: "b", label: "Working on a separate line of development." },
      { id: "c", label: "Replacing the need for commits." },
    ],
    correctOptionId: "b",
    explanation: "Branches allow independent lines of development.",
  },
  {
    id: "react-1",
    moduleId: "react",
    prompt: "Which React Hook is commonly used to manage local component state?",
    options: [
      { id: "a", label: "useState" },
      { id: "b", label: "useDatabase" },
      { id: "c", label: "useServerFile" },
    ],
    correctOptionId: "a",
    explanation: "useState provides a state value and a setter function.",
  },
  {
    id: "react-2",
    moduleId: "react",
    prompt: "Why should mapped React elements have stable keys?",
    options: [
      { id: "a", label: "To make every request secure automatically." },
      { id: "b", label: "To help React identify elements between renders." },
      { id: "c", label: "To prevent components from ever rerendering." },
    ],
    correctOptionId: "b",
    explanation: "Keys help React match list items when the list changes.",
  },
  {
    id: "node-1",
    moduleId: "node-express",
    prompt: "What is Express commonly used for in a Node.js application?",
    options: [
      { id: "a", label: "Defining HTTP routes and request handlers." },
      { id: "b", label: "Writing CSS animations only." },
      { id: "c", label: "Replacing JavaScript with SQL." },
    ],
    correctOptionId: "a",
    explanation: "Express provides routing and middleware for web applications.",
  },
  {
    id: "node-2",
    moduleId: "node-express",
    prompt: "What is middleware commonly used for in Express?",
    options: [
      { id: "a", label: "Only changing the screen brightness." },
      { id: "b", label: "Handling work such as logging, validation, or authentication." },
      { id: "c", label: "Creating Git commits automatically." },
    ],
    correctOptionId: "b",
    explanation: "Middleware can inspect or process requests before the final handler.",
  },
  {
    id: "sql-1",
    moduleId: "databases-sql",
    prompt: "What is the purpose of a primary key?",
    options: [
      { id: "a", label: "To uniquely identify each row in a table." },
      { id: "b", label: "To make every column optional." },
      { id: "c", label: "To style database results." },
    ],
    correctOptionId: "a",
    explanation: "A primary key uniquely identifies each row.",
  },
  {
    id: "sql-2",
    moduleId: "databases-sql",
    prompt: "Which SQL clause is commonly used to group rows for aggregate calculations?",
    options: [
      { id: "a", label: "ORDER BY" },
      { id: "b", label: "GROUP BY" },
      { id: "c", label: "DROP TABLE" },
    ],
    correctOptionId: "b",
    explanation: "GROUP BY groups rows so aggregate functions can be calculated per group.",
  },
  {
    id: "auth-1",
    moduleId: "auth-security",
    prompt: "What is the difference between authentication and authorization?",
    options: [
      { id: "a", label: "Authentication verifies identity; authorization checks permissions." },
      { id: "b", label: "They always mean exactly the same thing." },
      { id: "c", label: "Authorization is only used for page styling." },
    ],
    correctOptionId: "a",
    explanation: "Authentication verifies who a user is; authorization determines what they may access.",
  },
  {
    id: "auth-2",
    moduleId: "auth-security",
    prompt: "How should an application store user passwords?",
    options: [
      { id: "a", label: "As readable plain text." },
      { id: "b", label: "In a public file." },
      { id: "c", label: "As salted hashes using a suitable password-hashing algorithm." },
    ],
    correctOptionId: "c",
    explanation: "Passwords should be stored using a purpose-built password-hashing algorithm.",
  },
  {
    id: "deploy-1",
    moduleId: "testing-deployment",
    prompt: "What does a unit test usually focus on?",
    options: [
      { id: "a", label: "A small, isolated unit of behavior." },
      { id: "b", label: "Only the production server's physical location." },
      { id: "c", label: "The entire internet at once." },
    ],
    correctOptionId: "a",
    explanation: "Unit tests target a small unit of behavior in isolation.",
  },
  {
    id: "deploy-2",
    moduleId: "testing-deployment",
    prompt: "Where should production secrets such as a server API key be stored?",
    options: [
      { id: "a", label: "Inside public client-side source code." },
      { id: "b", label: "In server-side environment variables or a secrets manager." },
      { id: "c", label: "In the page title." },
    ],
    correctOptionId: "b",
    explanation: "Production secrets must not be exposed to the browser or committed to source control.",
  },
];

export function evaluatePlacementAnswers(
  answers: Record<string, string>,
) {
  const modules: PlacementModuleResult[] = placementModuleIds.map(
    (moduleId) => {
      const questions = placementQuestions.filter(
        (question) => question.moduleId === moduleId,
      );

      const correctCount = questions.filter(
        (question) =>
          answers[question.id] === question.correctOptionId,
      ).length;

      const score =
        questions.length === 0
          ? 0
          : Math.round((correctCount / questions.length) * 100);

      return {
        moduleId,
        totalQuestions: questions.length,
        correctCount,
        score,
        // Temporary conservative rule: both questions must be correct.
        mastered:
          questions.length > 0 && correctCount === questions.length,
      };
    },
  );

  const correctCount = placementQuestions.filter(
    (question) =>
      answers[question.id] === question.correctOptionId,
  ).length;

  return {
    totalQuestions: placementQuestions.length,
    correctCount,
    overallScore: Math.round(
      (correctCount / placementQuestions.length) * 100,
    ),
    modules,
  };
}