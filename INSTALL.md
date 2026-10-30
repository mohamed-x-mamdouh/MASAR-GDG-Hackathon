# Masarak — Topic Assessment & Admin Panel patch

This patch adds the first database-driven, topic-level placement assessment. It is designed around the current provisional Full-Stack roadmap in `lib/curriculum.ts`; it does not claim that the roadmap content is final.

## What this patch adds

- 23 provisional topics across the current 10 roadmap modules.
- 46 starter multiple-choice questions stored in Supabase (2 per topic).
- Student self-selection: `I know this`, `I don't know this`, or `I'm not sure`.
- Only topics marked `know` or `unsure` are tested. Topics marked `unknown` are saved as learning starting points and are not tested.
- Up to 6 tested topics per attempt, with 2 randomly selected questions per topic (maximum 12 questions).
- Per-topic result: `screening_passed`, `needs_review`, `needs_learning`, or `self_reported_unknown`.
- A saved report with answer feedback and explanations, linked from the student's Profile.
- A protected `/admin` panel for adding/editing topics, adding questions, archiving questions, and archiving topics.
- Topic status display in each roadmap module. Learning resources remain viewable so a student can go directly to a specific topic instead of being blocked by the old whole-module gate.

A 2-question pass is deliberately called **Screening passed**, not mastery or certification. It is a short initial signal. The question bank can be expanded from the Admin Panel.

## 1. Copy the patch into the project

Extract this ZIP into the root of your `masarak` project and allow the files to merge/overwrite. It contains complete replacements only for the files listed here, plus new files:

- `app/onboarding/assessment/page.tsx`
- `app/profile/page.tsx`
- `app/roadmap/[moduleId]/page.tsx`
- `components/site-header.tsx`
- `components/dashboard-client.tsx`
- `components/roadmap-client.tsx`
- `app/roadmap/page.tsx`

All other files in the patch are new.

## 2. Import the new CSS

At the top of `app/globals.css`, add this line after the existing `@import` statements:

```css
@import "./topic-assessment.css";
```

Do not replace your existing `globals.css`.

## 3. Run the Supabase migration

Open Supabase → SQL Editor, paste and run:

`supabase/topic-assessment.sql`

It is an additive migration. It does not remove the legacy module quiz tables or the old placement tables. It creates topic, question, attempt, answer, and per-student topic mastery tables, then seeds the 23 provisional topics and 46 starter questions.

The migration deliberately blocks direct client access to question answer keys, assessment snapshots, answer records, and mastery rows. The server actions and a security-definer RPC handle those operations.

## 4. Promote your account to Admin

After the migration, run this separately in SQL Editor. Replace the email with the email of the account you use to sign in to Masarak:

```sql
UPDATE public.profiles AS p
SET role = 'admin'
FROM auth.users AS u
WHERE u.id = p.id
  AND lower(u.email) = lower('YOUR_LOGIN_EMAIL');
```

Only this account will see the Admin link in the header and be allowed to use `/admin`. Do not make the role editable from the client/profile form.

## 5. Environment variable

The server needs `SUPABASE_SECRET_KEY` configured in `.env.local` and in Vercel Production. Keep it server-only (never prefix it with `NEXT_PUBLIC_`) and store it as a Secret in Vercel. Do not commit it.

## 6. Run and test

```bash
npm run lint
npm run build
npm run dev
```

Test in this order:

1. Sign in with the account promoted to Admin and open `/admin`.
2. Confirm the 23 seeded topics appear and each has at least 2 active questions.
3. Open a topic, add a new question, archive a question, and confirm the active count updates.
4. Sign in as a normal student and open `/onboarding/assessment`.
5. Mark one topic `I don't know this`, one `I know this`, and one `I'm not sure`.
6. Submit. Confirm only the latter two topics were tested and the unknown topic was listed as a learning starting point.
7. Confirm the report and answer explanations appear, then open `/profile/assessment` and refresh to verify the report was persisted.
8. Open the Roadmap and a module. Confirm the overview reflects topic-level results, topic statuses are shown, and learning resources remain accessible.
9. Open Dashboard and Profile. Confirm the latest report link works and topic assessment is the primary progress flow.
10. Try an attempt with more than six tested topics; the UI should require splitting it into another short session.

## Assessment rules

- The student may select `I know this`, `I don't know this`, or `I'm not sure` for each topic.
- Topics marked `I don't know this` are not tested; they are stored as self-reported learning needs.
- Topics marked `I know this` or `I'm not sure` are tested. The app selects 2 active questions per selected topic, up to 6 tested topics (12 questions) per attempt.
- `2/2` is stored as `Screening passed`, `1/2` as `Needs review`, and `0/2` as `Start learning`. These are short screening outcomes, not mastery certificates.
- Every attempt stores an immutable question snapshot, answers, feedback, and a report. The latest report ID is linked from `profiles`; past attempts remain in the attempts table.

## Scope note: CV parsing

This release implements manual skill selection and topic assessment. It does **not** claim to extract skills from a CV. The assessment page states that CV extraction is not enabled in this release; do not advertise CV parsing until an actual parser, consent, data-retention rules, and deletion flow are implemented.

## Important compatibility note

The previous `placement-assessment-client.tsx`, `lib/placement-assessment.ts`, and old `submitPlacementAssessmentAction` are left in the repository for now, but the `/onboarding/assessment` route no longer uses that old fixed 18-question flow. After the new flow is verified in production, the old code and old placement tables can be cleaned up in a separate migration.
