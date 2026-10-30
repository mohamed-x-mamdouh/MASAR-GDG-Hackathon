export type ModuleStatus = "completed" | "current" | "locked";

export type PublicCurriculumModule = {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: string;
  skills: string[];
  prerequisites: string[];
};

export const curriculum: PublicCurriculumModule[] = [
  {
    id: "web-fundamentals",
    number: 1,
    title: "Web Fundamentals",
    description:
      "Understand how the web works, browsers communicate, and websites are delivered.",
    duration: "1 week",
    skills: ["HTTP", "DNS", "Browser basics"],
    prerequisites: [],
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
  },
  {
    id: "node-express",
    number: 6,
    title: "Node.js & Express",
    description: "Create server-side applications and REST APIs.",
    duration: "2 weeks",
    skills: ["Node.js", "REST APIs", "Middleware"],
    prerequisites: ["react"],
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
  },
];