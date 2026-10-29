export type ModuleStatus = "completed" | "current" | "locked";

export type LearningResource = {
  title: string;
  type: "Video" | "Documentation" | "Practice" | "Project";
  url: string;
  provider: string;
};

export type CurriculumModule = {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: string;
  skills: string[];
  prerequisites: string[];
  objectives: string[];
  resources: LearningResource[];
  task: string;
  completionCriteria: string[];
};

export const curriculum: CurriculumModule[] = [
  {
    id: "web-fundamentals",
    number: 1,
    title: "Web Fundamentals",
    description:
      "Understand how the web works, browsers communicate, and websites are delivered.",
    duration: "1 week",
    skills: ["HTTP", "DNS", "Browser basics"],
    prerequisites: [],
    objectives: [
      "Understand the client-server model.",
      "Explain HTTP requests and responses.",
      "Understand domains, DNS, and hosting.",
    ],
    resources: [
      {
        title: "How the Internet Works",
        type: "Video",
        url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work",
        provider: "MDN",
      },
    ],
    task: "Draw a request-flow diagram showing what happens when a user opens a website.",
    completionCriteria: [
      "Explain the client-server model.",
      "Describe a request and response.",
      "Submit the website request-flow diagram.",
    ],
  },
  {
    id: "html-css",
    number: 2,
    title: "HTML & CSS",
    description:
      "Build accessible, responsive web pages with semantic HTML and modern CSS.",
    duration: "2 weeks",
    skills: ["HTML", "CSS", "Responsive design"],
    prerequisites: ["web-fundamentals"],
    objectives: [
      "Structure pages using semantic HTML.",
      "Build layouts with Flexbox and Grid.",
      "Create responsive interfaces.",
    ],
    resources: [
      {
        title: "HTML Learning Path",
        type: "Documentation",
        url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content",
        provider: "MDN",
      },
      {
        title: "CSS Learning Path",
        type: "Documentation",
        url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics",
        provider: "MDN",
      },
    ],
    task: "Build a responsive multi-section personal portfolio page.",
    completionCriteria: [
      "Use semantic HTML.",
      "Support mobile and desktop layouts.",
      "Submit a working portfolio page.",
    ],
  },
  {
    id: "javascript",
    number: 3,
    title: "JavaScript",
    description:
      "Learn programming fundamentals and build interactive browser experiences.",
    duration: "3 weeks",
    skills: ["ES6+", "DOM", "Async JavaScript"],
    prerequisites: ["html-css"],
    objectives: [
      "Use functions, arrays, objects, and modules.",
      "Handle browser events and update the DOM.",
      "Understand promises and async/await.",
    ],
    resources: [
      {
        title: "JavaScript Guide",
        type: "Documentation",
        url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        provider: "MDN",
      },
    ],
    task: "Build an interactive task tracker with filtering and local state.",
    completionCriteria: [
      "Use functions and array methods.",
      "Handle user interactions.",
      "Demonstrate working task filtering.",
    ],
  },
  {
    id: "git-github",
    number: 4,
    title: "Git & GitHub",
    description:
      "Track code changes and collaborate using a professional version-control workflow.",
    duration: "1 week",
    skills: ["Git", "Branches", "Pull workflow"],
    prerequisites: ["javascript"],
    objectives: [
      "Understand commits and branches.",
      "Create and merge branches.",
      "Maintain a useful project README.",
    ],
    resources: [
      {
        title: "Git Handbook",
        type: "Documentation",
        url: "https://docs.github.com/en/get-started/using-git/about-git",
        provider: "GitHub",
      },
    ],
    task: "Publish a project with a README and a clean commit history.",
    completionCriteria: [
      "Push a repository to GitHub.",
      "Create a feature branch.",
      "Document the project setup.",
    ],
  },
  {
    id: "react",
    number: 5,
    title: "React",
    description:
      "Build reusable user interfaces with components, state, and modern React patterns.",
    duration: "3 weeks",
    skills: ["Components", "Hooks", "Forms"],
    prerequisites: ["javascript", "git-github"],
    objectives: [
      "Compose reusable components.",
      "Manage state and props.",
      "Build forms and handle user interactions.",
    ],
    resources: [
      {
        title: "React Learn",
        type: "Documentation",
        url: "https://react.dev/learn",
        provider: "React",
      },
    ],
    task: "Build a responsive dashboard with reusable components and functional forms.",
    completionCriteria: [
      "Use components and props correctly.",
      "Manage state with React hooks.",
      "Demonstrate working forms.",
    ],
  },
  {
    id: "node-express",
    number: 6,
    title: "Node.js & Express",
    description: "Create server-side applications and REST APIs.",
    duration: "2 weeks",
    skills: ["Node.js", "REST APIs", "Middleware"],
    prerequisites: ["react"],
    objectives: [
      "Understand server-side JavaScript.",
      "Design REST endpoints.",
      "Handle requests, validation, and errors.",
    ],
    resources: [
      {
        title: "Node.js Learn",
        type: "Documentation",
        url: "https://nodejs.org/en/learn",
        provider: "Node.js",
      },
      {
        title: "Express Guide",
        type: "Documentation",
        url: "https://expressjs.com/en/guide/routing.html",
        provider: "Express",
      },
    ],
    task: "Build a REST API for managing projects and tasks.",
    completionCriteria: [
      "Implement CRUD endpoints.",
      "Validate incoming data.",
      "Handle errors consistently.",
    ],
  },
  {
    id: "databases-sql",
    number: 7,
    title: "Databases & SQL",
    description:
      "Model relational data and write queries that support application features.",
    duration: "2 weeks",
    skills: ["SQL", "Relationships", "Data modeling"],
    prerequisites: ["node-express"],
    objectives: [
      "Design relational schemas.",
      "Write queries and joins.",
      "Understand primary and foreign keys.",
    ],
    resources: [
      {
        title: "PostgreSQL Tutorial",
        type: "Documentation",
        url: "https://www.postgresql.org/docs/current/tutorial.html",
        provider: "PostgreSQL",
      },
    ],
    task: "Design a relational schema and queries for a learning platform.",
    completionCriteria: [
      "Create related tables.",
      "Write queries with joins.",
      "Explain the chosen relationships.",
    ],
  },
  {
    id: "auth-security",
    number: 8,
    title: "Authentication & Security",
    description:
      "Protect application data and implement secure access patterns.",
    duration: "2 weeks",
    skills: ["Authentication", "Authorization", "Validation"],
    prerequisites: ["databases-sql"],
    objectives: [
      "Distinguish authentication from authorization.",
      "Understand sessions and access control.",
      "Validate data and protect private routes.",
    ],
    resources: [
      {
        title: "OWASP Top 10",
        type: "Documentation",
        url: "https://owasp.org/www-project-top-ten/",
        provider: "OWASP",
      },
    ],
    task: "Implement protected resources with role-based access rules.",
    completionCriteria: [
      "Enforce authorization on the server.",
      "Validate user input.",
      "Test unauthorized access.",
    ],
  },
  {
    id: "testing-deployment",
    number: 9,
    title: "Testing & Deployment",
    description:
      "Verify application behavior and deploy a production-ready application.",
    duration: "2 weeks",
    skills: ["Testing", "CI basics", "Deployment"],
    prerequisites: ["auth-security"],
    objectives: [
      "Write tests for important behaviors.",
      "Configure production environment variables.",
      "Deploy and troubleshoot an application.",
    ],
    resources: [
      {
        title: "Next.js Deployment",
        type: "Documentation",
        url: "https://nextjs.org/docs/app/getting-started/deploying",
        provider: "Next.js",
      },
    ],
    task: "Deploy an application and document how to verify its main flows.",
    completionCriteria: [
      "Run production checks.",
      "Configure environment variables securely.",
      "Verify the deployed application.",
    ],
  },
  {
    id: "final-project",
    number: 10,
    title: "Final Full-Stack Project",
    description:
      "Combine frontend, backend, data, security, and deployment into one complete product.",
    duration: "3 weeks",
    skills: ["System design", "Integration", "Delivery"],
    prerequisites: ["testing-deployment"],
    objectives: [
      "Plan a complete application.",
      "Integrate UI, API, and persistent data.",
      "Demonstrate a deployed product.",
    ],
    resources: [
      {
        title: "Next.js Learn",
        type: "Documentation",
        url: "https://nextjs.org/learn",
        provider: "Next.js",
      },
    ],
    task: "Build, deploy, and present a complete Full-Stack application.",
    completionCriteria: [
      "Deliver a working application.",
      "Document architecture and setup.",
      "Demonstrate the core user journey.",
    ],
  },
];

// Initial sample progress for the demo. Real progress is managed separately
// by the learning-progress provider and updated when students pass quizzes.
export const demoCompletedModuleIds = ["web-fundamentals", "html-css"];

export function getModuleById(id: string) {
  return curriculum.find((curriculumModule) => curriculumModule.id === id);
}
