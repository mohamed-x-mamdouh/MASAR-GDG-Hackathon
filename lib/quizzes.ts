
export type QuizQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  explanation: string;
};

export type ModuleQuiz = {
  moduleId: string;
  title: string;
  passPercentage: number;
  questions: QuizQuestion[];
};

function question(
  id: string,
  prompt: string,
  choices: [string, string, string, string],
  correctIndex: number,
  explanation: string,
): QuizQuestion {
  return {
    id,
    prompt,
    options: choices.map((label, index) => ({
      id: String.fromCharCode(65 + index),
      label,
    })),
    correctOptionId: String.fromCharCode(65 + correctIndex),
    explanation,
  };
}

export const quizzes: ModuleQuiz[] = [
  {
    moduleId: "web-fundamentals",
    title: "Web Fundamentals Quiz",
    passPercentage: 70,
    questions: [
      question(
        "web-1",
        "What happens in the client-server model when a user opens a website?",
        [
          "The browser sends a request and the server returns a response.",
          "The server downloads the browser to the user's device.",
          "The browser always reads the server's database directly.",
          "The DNS server renders the website's user interface.",
        ],
        0,
        "The client, usually a browser, sends a request to a server, which processes it and returns a response.",
      ),
      question(
        "web-2",
        "What does an HTTP status code communicate?",
        [
          "The physical location of the user's device.",
          "The result or status of an HTTP request.",
          "The programming language used by a website.",
          "The number of users connected to the server.",
        ],
        1,
        "HTTP status codes describe the outcome of a request, such as success, redirection, or an error.",
      ),
      question(
        "web-3",
        "What is the primary role of DNS?",
        [
          "Encrypt every HTTP response.",
          "Store all files that make up a website.",
          "Translate domain names into information used to locate services, commonly IP addresses.",
          "Convert JavaScript into HTML.",
        ],
        2,
        "DNS helps clients discover where a domain's services can be reached.",
      ),
      question(
        "web-4",
        "What does HTTPS add to HTTP?",
        [
          "An encrypted connection using TLS, along with server authentication.",
          "A guarantee that the website contains no malicious code.",
          "Automatic compression of every image.",
          "A database for saving user accounts.",
        ],
        0,
        "HTTPS protects data in transit using TLS and helps authenticate the server. It does not guarantee that a site is safe in every other respect.",
      ),
    ],
  },
  {
    moduleId: "html-css",
    title: "HTML & CSS Quiz",
    passPercentage: 70,
    questions: [
      question(
        "html-1",
        "Why should a page use semantic HTML elements such as <main>?",
        [
          "They communicate the meaning and structure of page content.",
          "They automatically create a database.",
          "They replace the need for CSS.",
          "They guarantee that every page is responsive.",
        ],
        0,
        "Semantic elements give browsers, assistive technologies, and developers meaningful structural information.",
      ),
      question(
        "html-2",
        "What is the main purpose of useful alt text on an informative image?",
        [
          "To resize the image on mobile devices.",
          "To provide a text alternative describing the image's relevant information.",
          "To load the image faster in every browser.",
          "To apply a CSS animation.",
        ],
        1,
        "Alternative text communicates an informative image's meaning when the image cannot be perceived.",
      ),
      question(
        "html-3",
        "Which statement correctly describes Flexbox and CSS Grid?",
        [
          "Both work only with text elements.",
          "Flexbox is only for mobile devices.",
          "Flexbox is mainly one-dimensional; Grid supports two-dimensional row and column layouts.",
          "Grid replaces HTML and removes the need for elements.",
        ],
        2,
        "Flexbox focuses on a row or column at a time, while Grid manages rows and columns together.",
      ),
      question(
        "html-4",
        "What does a CSS media query allow you to do?",
        [
          "Apply styles when specified device or viewport conditions are met.",
          "Create server-side API endpoints.",
          "Validate database records.",
          "Run JavaScript without a browser.",
        ],
        0,
        "Media queries allow conditional styling, commonly for responsive layouts at different viewport widths.",
      ),
    ],
  },
  {
    moduleId: "javascript",
    title: "JavaScript Quiz",
    passPercentage: 70,
    questions: [
      question(
        "js-1",
        "What is the main difference between === and == in JavaScript?",
        [
          "=== compares only strings; == compares only numbers.",
          "=== compares without type coercion; == may coerce types.",
          "== always checks types more strictly than ===.",
          "There is no difference in JavaScript.",
        ],
        1,
        "Strict equality does not perform type coercion before comparing values.",
      ),
      question(
        "js-2",
        "How do you register a click handler on a DOM element?",
        [
          "element.addEventListener('click', handler)",
          "element.listenClick(handler)",
          "element.createEvent('click', handler)",
          "element.on('event', 'click', handler) in the standard DOM API",
        ],
        0,
        "The standard DOM API uses addEventListener to register an event listener.",
      ),
      question(
        "js-3",
        "What does Array.prototype.map() return?",
        [
          "The first element of the original array.",
          "A boolean indicating whether all elements match a condition.",
          "A new array containing the callback's results for each element.",
          "The original array sorted in place.",
        ],
        2,
        "map() transforms each element through a callback and returns a new array.",
      ),
      question(
        "js-4",
        "What does calling an async function return?",
        [
          "Always a plain string.",
          "A Promise.",
          "A DOM element.",
          "A synchronous callback result with no Promise.",
        ],
        1,
        "An async function always returns a Promise; its returned value becomes the Promise's fulfillment value.",
      ),
    ],
  },
  {
    moduleId: "git-github",
    title: "Git & GitHub Quiz",
    passPercentage: 70,
    questions: [
      question(
        "git-1",
        "What does a Git commit represent?",
        [
          "A snapshot of tracked project content and metadata in the repository history.",
          "A command that publishes a website to production.",
          "A remote server account.",
          "A permanent lock preventing future edits.",
        ],
        0,
        "A commit records a snapshot of the repository's tracked content along with metadata and its history links.",
      ),
      question(
        "git-2",
        "Why create a Git branch?",
        [
          "To install Node.js.",
          "To work on a separate line of development without immediately changing another branch.",
          "To delete the repository history.",
          "To automatically deploy every file.",
        ],
        1,
        "Branches let developers isolate work before integrating it into another branch.",
      ),
      question(
        "git-3",
        "What does git status help you inspect?",
        [
          "The number of visitors on GitHub.",
          "The CSS styles of the current page.",
          "The working tree, staging area, and branch state.",
          "The production server's CPU usage.",
        ],
        2,
        "git status reports changes, staged files, and other repository state information.",
      ),
      question(
        "git-4",
        "What does git push normally do?",
        [
          "Creates a local commit without staging.",
          "Deletes the remote repository.",
          "Downloads remote commits and merges them automatically.",
          "Sends local commits to a remote repository.",
        ],
        3,
        "git push updates the remote repository with the selected local branch's commits, subject to remote rules.",
      ),
    ],
  },
  {
    moduleId: "react",
    title: "React Quiz",
    passPercentage: 70,
    questions: [
      question(
        "react-1",
        "What is a React component?",
        [
          "A reusable piece of UI that can accept inputs and render content.",
          "A database table that stores all React state.",
          "A CSS file that must contain every website style.",
          "A server that replaces the browser.",
        ],
        0,
        "Components let you organize an interface into reusable pieces of UI.",
      ),
      question(
        "react-2",
        "What are props typically used for?",
        [
          "To change a database schema directly.",
          "To pass data from a parent component to a child component.",
          "To replace all JavaScript functions.",
          "To store secrets securely in the browser.",
        ],
        1,
        "Props are inputs passed to a component, commonly from its parent.",
      ),
      question(
        "react-3",
        "What is useState used for in a client component?",
        [
          "To create a new Git branch.",
          "To fetch CSS files from a server automatically.",
          "To keep component state and update it through a setter.",
          "To declare a PostgreSQL table.",
        ],
        2,
        "useState provides a state value and a setter that requests a re-render when the state changes.",
      ),
      question(
        "react-4",
        "Why should list items have stable keys?",
        [
          "To make every item appear in alphabetical order.",
          "To encrypt each item's data.",
          "To stop users from interacting with the list.",
          "To help React identify items across list updates.",
        ],
        3,
        "Stable keys help React match list items when items are added, removed, or reordered.",
      ),
    ],
  },
  {
    moduleId: "node-express",
    title: "Node.js & Express Quiz",
    passPercentage: 70,
    questions: [
      question(
        "node-1",
        "What does Node.js allow developers to do?",
        [
          "Run JavaScript outside the browser, including server-side programs.",
          "Use JavaScript only for CSS animations.",
          "Replace SQL with HTML.",
          "Guarantee that a program never encounters runtime errors.",
        ],
        0,
        "Node.js runs JavaScript outside the browser and is commonly used for servers and tooling.",
      ),
      question(
        "node-2",
        "In Express middleware, what is next() commonly used for?",
        [
          "To compile TypeScript automatically in all projects.",
          "To pass control to the next middleware or route handler.",
          "To close every open HTTP connection.",
          "To create a database table.",
        ],
        1,
        "Calling next() passes control through the Express middleware chain unless an error path is used.",
      ),
      question(
        "node-3",
        "Which HTTP method is commonly used to retrieve a resource?",
        [
          "PATCH",
          "DELETE",
          "GET",
          "POST only",
        ],
        2,
        "GET is the standard HTTP method for retrieving a representation of a resource.",
      ),
      question(
        "node-4",
        "Where should an API validate untrusted request data?",
        [
          "Only in the browser, because clients cannot be modified.",
          "Only inside the README.",
          "Nowhere, if the endpoint uses Express.",
          "On the server before using the data.",
        ],
        3,
        "Client-side validation improves usability, but the server must validate untrusted input because clients can bypass browser checks.",
      ),
    ],
  },
  {
    moduleId: "databases-sql",
    title: "Databases & SQL Quiz",
    passPercentage: 70,
    questions: [
      question(
        "db-1",
        "What is the main purpose of a primary key?",
        [
          "To uniquely identify each row in a table.",
          "To encrypt every database column.",
          "To order all query results automatically.",
          "To store a copy of the complete database.",
        ],
        0,
        "A primary key uniquely identifies each row and cannot be null.",
      ),
      question(
        "db-2",
        "What does a foreign key typically represent?",
        [
          "A password stored outside the database.",
          "A relationship to a key in another table or the same table.",
          "A rule that prevents all updates.",
          "A table's display color.",
        ],
        1,
        "A foreign key expresses a relationship and can enforce referential integrity.",
      ),
      question(
        "db-3",
        "What is a SQL JOIN generally used for?",
        [
          "To convert SQL into CSS.",
          "To delete every row from two tables.",
          "To combine related rows from tables based on a join condition.",
          "To create a user interface component.",
        ],
        2,
        "JOIN combines rows from multiple tables according to a specified relationship or condition.",
      ),
      question(
        "db-4",
        "What is a common trade-off of adding a database index?",
        [
          "Indexes always slow down every read and write equally.",
          "Indexes remove the need for table relationships.",
          "Indexes guarantee that all queries are instant.",
          "Indexes can speed up some reads but consume storage and add write overhead.",
        ],
        3,
        "Indexes can improve lookup performance, but require storage and maintenance when data changes.",
      ),
    ],
  },
  {
    moduleId: "auth-security",
    title: "Authentication & Security Quiz",
    passPercentage: 70,
    questions: [
      question(
        "security-1",
        "What is the difference between authentication and authorization?",
        [
          "Authentication checks identity; authorization checks permitted actions.",
          "Authentication controls CSS; authorization controls HTML.",
          "They are identical terms that always mean password reset.",
          "Authorization proves identity, while authentication assigns permissions.",
        ],
        0,
        "Authentication establishes who a user is; authorization determines what they are allowed to do.",
      ),
      question(
        "security-2",
        "How should an application store user passwords?",
        [
          "As plain text in a public configuration file.",
          "As suitably salted password hashes produced by a password-hashing algorithm.",
          "As reversible Base64 text.",
          "In the URL query string.",
        ],
        1,
        "Passwords should be stored using an appropriate password-hashing scheme, never as plaintext or merely encoded text.",
      ),
      question(
        "security-3",
        "Why must a server validate data even if the frontend has validation?",
        [
          "Frontend validation always fails to run.",
          "Servers cannot receive data from browsers.",
          "Clients can bypass or modify frontend checks.",
          "It makes all API responses public.",
        ],
        2,
        "Requests can come from modified clients or direct HTTP calls, so server-side validation is essential.",
      ),
      question(
        "security-4",
        "Which practice helps reduce SQL injection risk for database queries?",
        [
          "Concatenate all user input directly into SQL strings.",
          "Trust all incoming query parameters.",
          "Hide the submit button from users.",
          "Use parameterized queries for untrusted values.",
        ],
        3,
        "Parameterized queries keep user-supplied values separate from SQL syntax.",
      ),
    ],
  },
  {
    moduleId: "testing-deployment",
    title: "Testing & Deployment Quiz",
    passPercentage: 70,
    questions: [
      question(
        "testing-1",
        "What does a unit test usually verify?",
        [
          "A small, isolated unit of code under defined conditions.",
          "Every possible production behavior in one test.",
          "The visual design of a GitHub repository.",
          "The number of employees in a company.",
        ],
        0,
        "Unit tests focus on small pieces of code, usually with controlled inputs and expected outcomes.",
      ),
      question(
        "testing-2",
        "Why should secrets be stored in environment variables or a secret manager?",
        [
          "To make them visible in the public repository.",
          "To separate sensitive configuration from committed source code.",
          "To guarantee that a secret can never leak.",
          "To avoid validating API requests.",
        ],
        1,
        "Separating secrets from source control reduces exposure, though correct access controls are still needed.",
      ),
      question(
        "testing-3",
        "What does a successful production build prove?",
        [
          "Every feature has been tested with real users.",
          "No security issue can exist.",
          "The application was able to complete its production build, but every user flow is not thereby proven correct.",
          "The database is guaranteed to be configured correctly.",
        ],
        2,
        "Build success is useful validation, but functional tests and environment checks are still necessary.",
      ),
      question(
        "testing-4",
        "What is a common purpose of continuous integration (CI)?",
        [
          "To skip all checks before merging code.",
          "To let only one developer edit a project forever.",
          "To deploy code without checking its state under any condition.",
          "To automate checks such as tests, linting, or builds when code changes.",
        ],
        3,
        "CI automates repeatable checks on changes so teams can detect problems earlier.",
      ),
    ],
  },
  {
    moduleId: "final-project",
    title: "Final Full-Stack Project Quiz",
    passPercentage: 70,
    questions: [
      question(
        "final-1",
        "Why should a team clarify requirements before implementing a major feature?",
        [
          "To understand the user problem, intended behavior, and acceptance criteria.",
          "To avoid speaking to users or teammates.",
          "To guarantee that no future changes will be required.",
          "To remove the need for testing.",
        ],
        0,
        "Clear requirements align the team on the problem, scope, expected behavior, and success criteria.",
      ),
      question(
        "final-2",
        "What should a relational data model define?",
        [
          "Only button colors and typography.",
          "Entities, their attributes, and relationships between them.",
          "Only deployment URLs.",
          "A different database for every page by default.",
        ],
        1,
        "A data model defines the structure of the data and how entities relate to each other.",
      ),
      question(
        "final-3",
        "What does end-to-end integration mean in a full-stack project?",
        [
          "Writing only the frontend in isolation.",
          "Creating a README without a working application.",
          "Connecting the relevant UI, backend/API, and data layer to support a complete user flow.",
          "Replacing every external service with a screenshot.",
        ],
        2,
        "A full-stack flow connects the interface to application logic and data storage where required.",
      ),
      question(
        "final-4",
        "What is useful to include in a project README?",
        [
          "Private API keys and passwords.",
          "Only the project name, with no setup instructions.",
          "A copy of the entire node_modules directory.",
          "Project purpose, setup steps, important commands, and relevant configuration notes.",
        ],
        3,
        "A useful README helps another developer understand, run, and work on the project without exposing secrets.",
      ),
    ],
  },
];

export function getQuizByModuleId(moduleId: string): ModuleQuiz | undefined {
  return quizzes.find((quiz) => quiz.moduleId === moduleId);
}
