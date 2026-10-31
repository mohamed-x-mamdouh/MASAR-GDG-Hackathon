# AGENTS.md — Masarak Project Guide

> Last updated: 2026-10-31  
> Purpose: Give coding agents and contributors a reliable description of Masarak, its architecture, data model, current implementation state, and development rules.

## 1. Project identity

**Masarak** is a learning-guidance platform for university students, initially focused on a **Full-Stack Development** learning track. Its purpose is to reduce the feeling of being lost, overwhelmed, or distracted by disconnected courses and resources.

Masarak should help a student answer four questions:

1. Where am I starting from?
2. What should I learn next?
3. How does this topic fit into the larger learning journey?
4. How can I verify that I actually understand and can apply what I learned?

The product is not intended to be just a static list of links or a generic roadmap. It is intended to combine a curated learning structure, a clear next step, knowledge checks, and visible progress.

### Product principles

- **Clarity over volume:** show the student the next useful step instead of overwhelming them with an entire library of content.
- **Structured progression:** modules, topics, lessons, prerequisites, and quizzes should form a coherent path.
- **Verified progress:** progress should be based on persisted activity and assessment results, not only on clicking a completion button.
- **Curated content:** administrators control the official learning content and its order.
- **Versioned curriculum:** publishing a new curriculum must not silently change the learning path of students already enrolled in an earlier version.
- **Real MVP behavior:** external testers must use real accounts and shared persistent data. Do not replace important flows with demo-only or browser-local state and call the product production-ready.

## 2. Users and product flows

### Student

The intended student journey is:

1. Create an account and sign in.
2. Complete onboarding and choose how to start, or take the placement assessment when available.
3. Be enrolled in a published roadmap version.
4. View the roadmap and identify the next available module.
5. Open a module, study its topics and lessons, and use the resources attached to the appropriate level.
6. Complete topic quizzes and the module quiz.
7. Unlock subsequent learning according to prerequisites and assessment rules.
8. See persisted progress reflected in the dashboard and roadmap.

The exact student-facing implementation is still being migrated from the original static curriculum to the database-backed, published roadmap. Do not assume that every part of the intended journey is already connected end-to-end.

### Administrator

An administrator maintains the curriculum through a draft-first workflow:

1. Open the admin area.
2. Select the relevant track and draft roadmap version.
3. Create and edit modules, prerequisites, and topics.
4. Add lessons to topics.
5. Add general resources to modules and specific resources to lessons.
6. Manage topic and module quiz questions through the quiz-management phase of the project.
7. Preview and validate the draft before publishing it.

Administrators must not edit a published roadmap version in place. Content changes intended for students should be made in a draft version and then published through an explicit validation/publication process.

## 3. MVP scope and boundaries

### Core MVP scope

- Real authentication and user profiles.
- Admin authorization.
- One initial learning track: `full-stack-development`.
- Versioned roadmap content stored in Supabase/PostgreSQL.
- Modules and module prerequisites.
- Topics within modules.
- Lessons within topics.
- Module-wide resources.
- Lesson-specific resources.
- Topic quizzes and module quizzes, with server-side validation and persisted attempts.
- Student enrollment and progress records.
- Unlock logic based on prerequisites and learning progress.
- A placement assessment aligned with the new roadmap (rebuild/integration is still planned).
- Admin draft management and a safe publishing workflow.

### Explicitly out of the initial launch scope

Do not introduce these as required dependencies for the first usable MVP unless the product owner explicitly changes scope:

- Paid mentor sessions or mentor-review workflows.
- Student project submission and mentor grading.
- Subscription payments, company payments, or billing infrastructure.
- A large multi-track marketplace.
- Automated job scraping and job recommendations.
- Complex social/community features.
- Gamification such as streaks, points, and leaderboards as a prerequisite for launch.

These may be valuable later, but the initial priority is a trustworthy learning path with real content, assessments, and progress.

### Resource hierarchy — important

The agreed content hierarchy is:

```text
Track
└── Roadmap Version
    └── Module
        ├── Module Resources             (general resources for the whole module)
        └── Topic
            └── Lesson
                └── Lesson Resources     (resources specific to that lesson)
```

There is **no separate Topic Resources layer**. Do not create a `topic_resources` table or a Topic Resources UI unless the product owner explicitly reverses this decision. Resources belong either to the module as a whole or to a specific lesson.

## 4. Technology stack

The repository package manifest was checked during preparation of this guide. The current stack includes:

| Area | Technology |
|---|---|
| Framework | Next.js 16.4.3, App Router |
| UI runtime | React 19.3.0 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 and project CSS |
| Component system | HeroUI v3 (`@heroui/react`, `@heroui/styles`) |
| Icons | `lucide-react` |
| Backend and database | Supabase (PostgreSQL) |
| Authentication/session integration | `@supabase/ssr`, `@supabase/supabase-js` |
| Deployment target | Vercel is the intended deployment platform |

Use the dependency versions already installed in `package.json`. Do not upgrade Next.js, React, HeroUI, Supabase packages, Tailwind, or other core dependencies as part of an unrelated feature.

## 5. Application architecture

### Next.js conventions

- This is a Next.js **App Router** project.
- Routes live under `app/`.
- Prefer Server Components by default. Add `"use client"` only for UI that genuinely needs client-side state, effects, or browser interaction.
- Server Actions live in server-only action modules and must validate the current user and all submitted input.
- Next.js request APIs such as `cookies()` and dynamic route `params` are asynchronous in the installed Next.js version. Preserve the async pattern used in the existing code.
- Use `revalidatePath` or the appropriate cache invalidation mechanism after successful mutations when affected pages may be cached.
- Use `redirect()` and `notFound()` from `next/navigation` for route flow and missing resources.
- Keep server-only modules out of client component import graphs.

### Confirmed important files and modules

The following files/areas are known from the repository and recent local implementation work. The checked-out working tree is the source of truth for exact current contents and any files not yet pushed to GitHub.

```text
app/
├── page.tsx                              # Public homepage
├── layout.tsx                            # Root layout, site header/footer, progress provider
├── globals.css                           # Global design tokens and application styles
├── admin/
│   ├── page.tsx                          # Admin entry/launcher in the current local direction
│   ├── actions.ts                        # Legacy admin actions may still exist; audit before removal
│   ├── roadmap/
│   │   ├── page.tsx                      # Roadmap draft builder (modules and topics)
│   │   ├── actions.ts                    # Module/topic server actions
│   │   ├── content-actions.ts             # Lesson and lesson-resource actions
│   │   ├── module-resource-actions.ts     # Module-wide resource actions
│   │   ├── modules/[moduleId]/page.tsx    # Module details and module resources manager
│   │   └── topics/[topicId]/page.tsx      # Topic lessons and lesson resources manager
│   └── topics/[topicId]/page.tsx          # Legacy route; intended to redirect to the new roadmap admin area
├── roadmap/
│   ├── page.tsx                          # Original student roadmap page; historically static
│   └── [moduleId]/page.tsx               # Original static module detail page
└── onboarding/
    └── actions.ts                        # Existing onboarding/placement-related actions

components/
├── learning-progress-provider.tsx        # Existing learning-progress context/provider
├── site-header.tsx                       # Main site navigation
├── roadmap-client.tsx                    # Original student roadmap UI
├── module-topic-list.tsx                 # Existing topic list component
└── module-progress.tsx                   # Existing module progress/quiz UI

lib/
├── curriculum.ts                         # Legacy/static detailed curriculum source
├── curriculum-public.ts                  # Legacy/static public curriculum source
├── module-access.ts                      # Existing legacy module access logic
├── placement-assessment.ts                # Existing placement-assessment logic
└── supabase/
    ├── server.ts                         # Cookie-aware server Supabase client
    ├── admin.ts                          # Server-only Supabase service-role client
    └── proxy.ts                          # Session refresh helper used by root proxy.ts

proxy.ts                                  # Root request proxy; calls Supabase session refresh
supabase/
├── roadmap-content.sql                   # Roadmap content schema and initial seed
├── roadmap-learning-progress.sql         # Student progress tables and unlock RPCs
└── roadmap-module-resources.sql           # Separate module-wide resources table
```

This is a **working map**, not a guarantee that every listed file exists on every branch. Before editing, inspect the actual current file tree and contents. Do not create duplicate modules because a file is absent from an older GitHub commit.

### Styling and UI conventions

- Follow the existing visual system and CSS classes before inventing a new design system.
- Tailwind CSS 4 is installed; HeroUI v3 and its styles are already integrated.
- Use `lucide-react` for icons.
- Keep interfaces clear, calm, consistent, and responsive. Avoid unnecessary visual complexity.
- Prefer reusing existing layout components, form patterns, buttons, panels, and design tokens.
- Do not introduce a second component library without an explicit decision.

## 6. Supabase clients, authentication, and authorization

### Server Supabase client

`lib/supabase/server.ts` exports `createClient()` using `createServerClient` from `@supabase/ssr` and Next.js `cookies()`. It uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The client reads and writes the user's session cookies where the execution context allows it. The root `proxy.ts` calls `updateSession()` from `lib/supabase/proxy.ts` to refresh the session.

### Admin/service-role client

`lib/supabase/admin.ts` is marked with `import "server-only"` and exports `createAdminClient()`. It uses:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

This client bypasses Row Level Security. Treat it as highly privileged.

**Security rules:**

1. Never import `lib/supabase/admin.ts` into a Client Component.
2. Never expose `SUPABASE_SECRET_KEY` through a `NEXT_PUBLIC_` variable, HTML, client props, logs, or API responses.
3. Never trust a user ID, role, module ID, topic ID, version ID, or score sent by the browser without server-side verification.
4. Before using the admin client in an action, authenticate the request with the normal session client and verify the user's role from the trusted `profiles` row.
5. Re-check all resource relationships on the server. A valid UUID alone does not prove the caller may modify that resource.
6. Keep private quiz data and answer keys out of public queries and Client Component props.

### Roles

The current admin authorization model uses `profiles.role = 'admin'`. The user profile is associated with the authenticated Supabase user ID. Existing onboarding code also uses `profiles.selected_start_path` to determine whether the student has selected a starting path.

Do not assume a role value from client-side state or user metadata. Load and validate the profile on the server.

### Row Level Security

RLS is part of the application security boundary, not an optional extra. The roadmap schema work established these intended rules:

- Published, active roadmap content can be read by students.
- Draft and archived roadmap content must not be exposed to ordinary students.
- Quiz banks and answer keys must not be publicly readable.
- Student enrollment and progress are private to the owning student, except for properly authorized admin operations.
- Quiz attempt snapshots/private assessment data are restricted to privileged server-side access.
- Admin mutations use the server-only admin client after explicit server-side admin authorization.

When changing a table or adding a table, define and test its RLS policies in the same migration. Do not rely only on hiding a UI element.

## 7. Database domain model

The roadmap content is normalized around a track and immutable/published curriculum versions.

### Main content hierarchy

| Table | Responsibility |
|---|---|
| `learning_tracks` | Defines a learning track, identified by a stable slug such as `full-stack-development`. |
| `roadmap_versions` | A version of a track's curriculum. Versions move through Draft, Published, and Archived lifecycle states. |
| `roadmap_modules` | Ordered modules belonging to a roadmap version. Holds module metadata, objectives, duration, skills, completion criteria, quiz settings, and active status. |
| `roadmap_module_prerequisites` | Defines the module dependency graph within the same roadmap version. |
| `roadmap_topics` | Ordered topics belonging to a module and roadmap version. `legacy_topic_id` may be null; new topics do not need a legacy `learning_topics` record. |
| `learning_lessons` | Ordered lessons inside a roadmap topic. Holds lesson key, title, description, objectives, required/active flags. |
| `learning_resources` | Resources attached to a specific lesson. |
| `roadmap_module_resources` | General resources attached to a module, separate from lesson resources. |

Use stable keys (`module_key`, `topic_key`, `lesson_key`, and resource keys) for content identity and imports. Do not use display titles as identifiers. Preserve the relationship between each child record and its `roadmap_version_id`.

### Learning and assessment tables

The roadmap migration also defines or integrates with the following data areas:

| Table | Responsibility |
|---|---|
| `topic_quiz_questions` | Question bank for topic-level quizzes. Keep correct answers private. |
| `module_quiz_questions` | Question bank for module-level quizzes. Keep correct answers private. |
| `roadmap_enrollments` | Associates a student with a specific roadmap version. |
| `topic_quiz_attempts` | Persists a student's topic quiz attempts/results. |
| `topic_quiz_attempt_snapshots` | Stores the question/attempt snapshot needed for secure and reproducible attempt evaluation. |
| `student_topic_progress` | Persists topic-level student progress. |
| `student_module_progress` | Persists module-level student progress. |
| `student_lesson_progress` | Persists lesson-level student progress. |

The application also contains legacy assessment/progress tables and legacy `learning_topics` data. Do not delete or rename a legacy table until all references, RLS policies, foreign keys, and existing student data have been audited.

### Versioning rules

- A roadmap version belongs to a track.
- Modules, topics, lessons, and resources must belong to the same version as their parent hierarchy.
- Prerequisite links must not cross roadmap versions.
- A student's enrollment should identify the exact roadmap version they are following.
- New enrollments should use the latest published version.
- Existing students should remain pinned to their enrolled version unless a deliberate migration/re-enrollment feature is designed.
- Publishing should be an explicit operation with validation. Never silently make a draft visible to students.
- Do not edit published content in place. Create a new draft version for subsequent curriculum changes.

## 8. Initial roadmap seed

The initial seeded track is `full-stack-development`, with a first draft version and the following ten baseline modules:

1. `web-fundamentals`
2. `html-css`
3. `javascript`
4. `git-github`
5. `react`
6. `node-express`
7. `databases-sql`
8. `auth-security`
9. `testing-deployment`
10. `final-project`

The initial prerequisites form a progression chain, with React also depending on both JavaScript and Git/GitHub. This seed is a starting structure, not a claim that the full learning content has been finalized. Check the current database and migration before assuming the exact live curriculum or ordering.

The original static curriculum remains in `lib/curriculum.ts` and `lib/curriculum-public.ts`. Treat these as legacy compatibility/static sources until the database-backed student roadmap is fully integrated and the old usages are removed safely.

## 9. Module/topic/lesson content management

### Roadmap Builder

The admin Roadmap Builder is responsible for:

- Listing the track's roadmap versions and working with a Draft version.
- Creating and editing modules.
- Defining module prerequisites.
- Creating, editing, and archiving topics within a module.
- Preventing content edits against a Published or Archived version.
- Preventing new topics from being attached to an inactive/archived module.
- Preventing edits to archived topics.

The current local hardening direction uses a helper equivalent to `requireDraftFullStackVersion` to require both a Draft version and the `full-stack-development` track. Do not weaken this check when extending actions. If the product introduces multiple tracks, replace the hard-coded track restriction deliberately with a validated track-aware design.

### Module Resources

Module-wide resources live in `roadmap_module_resources`. They are for material useful across the whole module, not for a specific lesson. The admin manager is under:

`/admin/roadmap/modules/[moduleId]`

Resource fields include a stable resource key, title, type, URL, provider, description, language, optional duration, required flag, order, and active flag.

### Lessons and Lesson Resources

Lessons are managed inside a topic at:

`/admin/roadmap/topics/[topicId]`

Each lesson may contain its own ordered resources. Lesson resources belong to `learning_resources` and must reference the correct lesson and roadmap version.

When archiving a lesson or topic, consider dependent child resources and records. The desired behavior is to avoid active child resources under archived parents. Check the current SQL/action implementation before changing cascade or soft-archive behavior.

## 10. Progression, prerequisites, and unlock logic

The database-backed progression model uses persisted enrollment and progress records plus SQL functions. The known unlock functions are:

- `is_roadmap_module_unlocked(uuid, uuid, uuid)`
- `is_roadmap_topic_unlocked(uuid, uuid, uuid)`
- `is_roadmap_topic_quiz_unlocked(uuid, uuid, uuid)`
- `is_roadmap_module_quiz_unlocked(uuid, uuid, uuid)`

Their role is to centralize progression checks in PostgreSQL rather than trusting frontend calculations. Review the exact SQL definitions and call sites before changing their semantics.

General expectations:

- A student must be enrolled in the relevant roadmap version.
- A module's prerequisites must be satisfied before the module is unlocked.
- Topic access and topic-quiz access must follow the intended progression rules.
- A module quiz should only be available when the required module learning/topic conditions are satisfied.
- The server must enforce access even when a student manually calls an action or changes a URL.
- UI lock states are presentation only; they are not authorization.

Progress mutations must be tied to the authenticated student and their enrollment. Do not accept a student ID from the client as the authority for whose progress is being updated.

## 11. Quizzes and assessment security

Masarak has three distinct assessment concepts:

### Placement Assessment

- Purpose: estimate the student's current knowledge and select an appropriate starting point.
- It is distinct from learning-progress quizzes.
- It must be aligned with the new roadmap structure when rebuilt.
- Existing placement-assessment code is legacy and should be audited before being reused as the final roadmap placement flow.

### Topic Quiz

- Purpose: verify understanding after a topic.
- Question data is stored in the topic quiz bank.
- Attempt results and the information required to evaluate an attempt should be persisted.
- The student must never receive the correct answer key before submitting.

### Module Quiz

- Purpose: verify understanding across a module.
- It is separate from a topic quiz and may act as a gate for subsequent progress.
- Module quiz security was previously hardened so answer keys are not sent to the browser and attempt snapshots are persisted server-side.
- Preserve that security model when modifying the quiz UI or actions.

### Rules for all quizzes

1. Do not send `correct_answer`, answer-key fields, hidden scoring rules, or privileged question-bank data to the client before submission.
2. Do not trust a client-submitted score, correctness flag, passed flag, or unlocked-module ID.
3. Validate quiz identity, enrollment, roadmap version, student ownership, attempt state, and access conditions on the server.
4. Evaluate answers on the server against the authoritative question bank/snapshot.
5. Persist an attempt record and the relevant snapshot so later content edits do not retroactively change the meaning of a past attempt.
6. Prevent replay/tampering where the current attempt model supports it; do not invent a weaker client-authoritative shortcut.
7. Return only the result data the UI needs.
8. Keep RLS restrictive for question banks and snapshots.

The admin Quiz Managers (topic and module question authoring) are a later implementation phase. Do not assume they are complete just because the database question-bank tables exist.

## 12. Server Actions and mutation safety

For every Server Action that mutates roadmap or student data:

- Start with `"use server"` in the action module.
- Authenticate with the session-based server client.
- Verify `profiles.role === 'admin'` for admin mutations.
- Validate IDs, strings, URLs, enum values, arrays, durations, and numeric ranges on the server.
- Load the target record and verify every parent-child relationship, including roadmap version consistency.
- Ensure the roadmap version is Draft before modifying curriculum content.
- Verify the track restriction where the action is intended only for `full-stack-development`.
- Verify that parent modules/topics are active when creating or editing child content.
- Use the admin client only after authorization and validation.
- Prefer a single SQL RPC/transaction for operations that must be atomic (for example, updating a module and all prerequisite edges).
- Avoid partial updates that can leave orphaned prerequisites or child records.
- Return safe, user-facing errors. Log technical details server-side only when useful; do not expose secrets or raw internal data.
- Revalidate the routes affected by a successful mutation.

For RPC-based mutations, make sure the SQL function exists, has the expected argument names/types, validates relationships, and has safe EXECUTE grants. A passing TypeScript build does not prove an RPC exists in the database.

## 13. Admin routes and legacy routes

The current local admin direction is:

| Route | Purpose |
|---|---|
| `/admin` | Simple admin entry/launcher. |
| `/admin/roadmap` | Main draft roadmap builder for modules and topics. |
| `/admin/roadmap/modules/[moduleId]` | Module resource manager. |
| `/admin/roadmap/topics/[topicId]` | Topic lesson and lesson-resource manager. |
| `/admin/topics/[topicId]` | Legacy route intended to redirect to the new topic manager/builder. |

The old admin CMS previously managed legacy `learning_topics` and assessment questions. The intended direction is to stop exposing that old CMS as the main admin workflow. However:

- Audit all imports/call sites before deleting `app/admin/actions.ts` or legacy admin pages.
- Preserve legacy database tables while onboarding, placement assessment, or existing users still depend on them.
- A redirect route may still appear in `next build` output; route existence by itself does not mean the redirect is broken.
- Do not remove legacy code solely because a newer UI exists. Prove it has no required callers first.

## 14. Student routes and the static-to-dynamic migration

Known student-facing routes include:

- `/` — public landing page.
- `/signup` and `/login` — account entry.
- `/onboarding` and `/onboarding/assessment` — onboarding and existing assessment flow.
- `/dashboard` — student dashboard.
- `/roadmap` — original roadmap route.
- `/roadmap/[moduleId]` — original module detail route.

The original student roadmap pages use static curriculum modules from `lib/curriculum.ts` / `lib/curriculum-public.ts` and existing components such as `RoadmapClient`, `ModuleTopicList`, and `ModuleProgress`. The database-backed published roadmap must eventually replace this source without breaking auth, enrollment, progress, or existing quiz behavior.

Before connecting the dynamic student UI:

1. Load only the student's enrolled/published roadmap version.
2. Filter inactive modules/topics/lessons/resources.
3. Respect the student's pinned version.
4. Use server-side unlock checks, not only client filtering.
5. Handle empty, loading, missing, archived, and locked states.
6. Keep private quiz answer data out of client payloads.
7. Avoid mixing static IDs with database UUIDs without a deliberate mapping layer.
8. Remove legacy static dependencies only after all current callers have migrated and tests pass.

## 15. Curriculum authoring/import preparation

Curriculum content may be prepared outside the app (for example, with a spreadsheet) before it is entered or imported. The agreed planning structure uses separate logical sheets/sections for:

- `Modules`
- `Topics`
- `Lessons_Resources`
- `Topic_Quiz`
- `Module_Quiz`
- `Placement`

Use stable IDs/keys across sheets so that parent-child relationships do not depend on row position or display names. The existence of this agreed spreadsheet format does **not** mean an importer has already been implemented. Validate the current import code before claiming automated import support.

## 16. Environment and local development

Expected environment variables from the current Supabase client code:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Keep real values in local environment configuration and the hosting provider's secret store. Never commit `.env` files or secrets.

### Install and run

```bash
npm install
npm run dev
```

### Quality checks

Run all three checks after meaningful code changes:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

The package scripts currently include:

- `npm run dev` → `next dev`
- `npm run lint` → `eslint`
- `npm run build` → `next build`
- `npm run start` → `next start`

The last reported local validation after the recent roadmap action hardening passed all three checks: lint, TypeScript type-check, and production build. This does not replace runtime testing against the actual Supabase project.

## 17. Database migration workflow

Known roadmap SQL files applied by the project owner:

1. `supabase/roadmap-content.sql` — roadmap content tables, initial track/version/modules/topics seed, quiz banks, enrollment/progress foundations, and RLS policies.
2. `supabase/roadmap-learning-progress.sql` — lesson/module student progress and unlock functions/policies.
3. `supabase/roadmap-module-resources.sql` — separate module-wide resources table and policies.

A later hardening pass introduced or expects RPC-backed operations for atomic module/prerequisite changes and safe archive behavior. The exact migration application/runtime state must be verified against the connected Supabase database before relying on those RPCs.

Migration rules:

- Inspect the current schema before writing an `ALTER TABLE` or creating a function.
- Make migrations safe to understand and, where appropriate, safe to re-run.
- Keep schema changes, indexes, constraints, functions, grants, and RLS policies together when they form one feature.
- Add foreign keys and uniqueness constraints for version/parent relationships.
- Use transactions for coupled changes.
- Restrict privileged function execution explicitly; do not leave service-only mutation functions executable by `anon` or `authenticated` unless intentionally designed and validated.
- After applying SQL, query `information_schema` / `pg_proc` to verify expected functions and signatures.
- Test the RPC through the same Supabase role/client used by the application.
- Do not assume a successful `tsc` or `next build` proves the database migration was applied.
- Never delete production data or legacy tables as part of a cleanup without a reviewed migration and an explicit data-retention decision.

## 18. Current implementation status and known gaps

This section reflects the latest project discussion and local test reports available when this guide was written. Re-check the working tree and Supabase before starting a task.

### Completed or locally implemented

- Next.js App Router application, core landing/auth/onboarding/dashboard structure.
- Supabase SSR session client and server-only admin client.
- Admin role checks in roadmap-related pages/actions.
- Initial roadmap database schema and seed for the Full-Stack Development track.
- Student enrollment/progress schema and SQL unlock functions.
- Admin Modules & Topics Builder (Phase 3C) — reported working.
- Lessons and Lesson Resources manager (Phase 3D) — reported working.
- Separate Module Resources manager/table — reported working.
- Module quiz answer-key security and attempt snapshot work — completed in a prior phase.
- Recent roadmap Server Action hardening direction: Draft + track checks, active-parent checks, archived-topic protection, and RPC-based module/prerequisite/archive operations.
- Recent local checks after the latest `actions.ts` replacement: `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build` all passed.

### Still needs verification or implementation

- Verify all required hardening SQL RPCs are present in the target Supabase database, with correct signatures and safe grants.
- Run real admin CRUD/archive tests against Supabase; a successful build alone is insufficient.
- Confirm the legacy `/admin/topics/[topicId]` redirect and ensure legacy CMS actions are no longer an exposed admin workflow.
- Complete the atomicity/cascade checks for module prerequisites, topic archive, lesson archive, and child resources.
- Complete database-backed published roadmap integration on student-facing pages.
- Implement/finish Topic Quiz and Module Quiz admin managers.
- Rebuild/integrate the Placement Assessment against the new roadmap.
- Complete Draft → Preview → Validation → Publish lifecycle and student visibility rules.
- Verify enrollment pinning and latest-published-version assignment for new students.
- Remove legacy static/assessment dependencies only after migration is complete and callers are audited.

Do not describe the product as ready for external MVP launch until real-user flows, RLS, quiz security, publishing, and database-backed student progression have been exercised end-to-end.

## 19. Development workflow for coding agents

Before making changes:

1. Read this file and inspect the current working tree.
2. Check `package.json` and the relevant route/action/components before assuming file contents.
3. Trace the full flow: UI → Server Action → Supabase query/RPC → table/function/RLS → resulting UI state.
4. Identify legacy callers and side effects before removing or renaming anything.
5. Check whether a required migration is already present/applied.

While making changes:

- Work in small, coherent phases.
- Prefer the smallest safe change that preserves established architecture.
- Keep business rules on the server/database, not only in the UI.
- Preserve existing data and compatibility unless a migration plan explicitly changes them.
- Do not create a new abstraction, table, route, dependency, or UI layer unless it solves a real need.
- Do not create Topic Resources; use Module Resources or Lesson Resources.
- Do not expose service-role credentials, quiz answers, private attempt snapshots, or draft content.
- Do not introduce demo/fake data as a substitute for persistent MVP functionality.
- Keep TypeScript strict and avoid `any` unless a justified boundary requires it.
- Follow existing naming, import alias (`@/*`), and code organization conventions.
- Keep UI changes aligned with the established design system.

After making changes:

1. Run lint.
2. Run the TypeScript check.
3. Run a production build.
4. Test the relevant route/action against Supabase, including unauthorized and invalid-input cases.
5. Verify no private data is returned to the browser.
6. Explain which files changed, which SQL must be applied, and which manual tests remain.

Do not claim that a file was changed, a migration was applied, a test passed, or a deployment succeeded unless that operation actually happened and its result was observed.

## 20. Recommended manual test checklist

### Authentication and authorization

- Signed-out visitor cannot access protected student/admin data.
- Authenticated student cannot access admin routes or admin actions.
- Admin can access the roadmap builder.
- A forged client-side role or user ID does not grant access.

### Draft content management

- Admin can create and edit a module in a Draft version.
- Admin can add/edit prerequisites and the saved graph is correct.
- Admin cannot create a cycle or cross-version prerequisite if the schema/business rules prohibit it.
- Admin can create/edit/archive a topic in an active module.
- Archived topics cannot be edited or used as parents for new active content.
- Published and Archived roadmap versions reject content mutations.

### Resources and lessons

- Admin can create/reorder/archive module resources.
- Admin can create/reorder/archive lessons under the correct topic.
- Admin can create/reorder/archive lesson resources under the correct lesson.
- Resources cannot be attached across roadmap versions or to an unrelated parent.
- Archiving a parent does not leave visible active child content.

### Student visibility and progression

- Student sees only an eligible Published roadmap version.
- Student cannot read Draft or Archived content.
- Student enrollment is tied to one roadmap version.
- Prerequisite modules remain locked until requirements are met.
- Topic and module quiz availability matches server-side unlock functions.
- Progress belongs to the signed-in student and persists after refresh/sign-in.

### Quiz security

- Quiz answer keys are not present in initial browser responses or network payloads.
- Student cannot submit a forged score or pass flag.
- Attempt snapshots and results are saved correctly.
- Editing quiz content later does not corrupt the meaning of earlier attempts.

### Publishing

- A draft can be previewed and validated before publishing.
- Students cannot see a draft before publication.
- Publishing changes the version visible to new enrollments as designed.
- Existing enrollments remain on their pinned version unless deliberately migrated.

## 21. Repository and source-of-truth note

The GitHub default branch was inspected while preparing this guide. At that point, its public snapshot still contained the earlier static curriculum/admin implementation and did not expose all of the more recent local roadmap builder files discussed in the project work. Some roadmap work may therefore exist only in the developer's local working tree or an unpushed branch.

**Always trust the current checked-out working tree and actual database over this guide or an older remote snapshot.** Update this document when the architecture, table names, route behavior, migration state, or launch scope changes.

---

## 22. Instructions specific to the project owner

- Communicate explanations and implementation steps in concise Egyptian Arabic unless asked otherwise.
- When a change is small, identify the exact file and location. When several coordinated changes are needed, provide complete replacement files rather than ambiguous patch fragments.
- Work phase by phase and wait for the current phase's test results before proposing a large next phase.
- The project owner performs local edits, commits, and pushes. Do not claim to have edited their local repository or pushed to GitHub unless explicitly authorized and actually completed.
- After a phase passes its checks, suggest a clear conventional commit message.
