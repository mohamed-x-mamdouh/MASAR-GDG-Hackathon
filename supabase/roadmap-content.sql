
-- =========================================================
-- MASARAK: Database-backed Roadmap Content Foundation
-- Phase 3A
--
-- Additive migration:
-- - Preserves existing Placement Assessment data
-- - Preserves existing module quiz attempts and snapshots
-- - Creates versioned roadmap content
-- - Creates topic and module quiz question banks
-- - Creates student enrollment and topic progress tables
--
-- Run in Supabase SQL Editor.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0. Verify required legacy tables exist
-- ---------------------------------------------------------

do $$
begin
  if to_regclass('public.learning_topics') is null then
    raise exception
      'Missing public.learning_topics. Run topic-assessment.sql first.';
  end if;

  if to_regclass('public.quiz_attempts') is null then
    raise exception
      'Missing public.quiz_attempts. Run the initial schema first.';
  end if;

  if to_regclass('public.quiz_attempt_question_snapshots') is null then
    raise exception
      'Missing module quiz snapshots. Run module-quiz-snapshots.sql first.';
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 1. Learning Tracks
-- ---------------------------------------------------------

create table if not exists public.learning_tracks (
  id uuid primary key default gen_random_uuid(),

  slug text not null unique,
  title text not null,
  description text not null default '',

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 2. Roadmap Versions
-- ---------------------------------------------------------

create table if not exists public.roadmap_versions (
  id uuid primary key default gen_random_uuid(),

  track_id uuid not null
    references public.learning_tracks(id) on delete restrict,

  version_number integer not null check (version_number > 0),

  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),

  change_summary text not null default '',

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (track_id, version_number),
  unique (id, track_id)
);

-- One published version per track.
create unique index if not exists
  roadmap_versions_one_published_per_track_idx
on public.roadmap_versions (track_id)
where status = 'published';


-- ---------------------------------------------------------
-- 3. Roadmap Modules
-- ---------------------------------------------------------

create table if not exists public.roadmap_modules (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null
    references public.roadmap_versions(id) on delete restrict,

  module_key text not null,
  sort_order integer not null check (sort_order > 0),

  title text not null,
  description text not null default '',

  estimated_duration text not null default '',

  skills text[] not null default '{}',
  objectives text[] not null default '{}',
  completion_criteria text[] not null default '{}',

  topic_quiz_pass_percentage integer not null default 70
    check (topic_quiz_pass_percentage between 0 and 100),

  module_quiz_pass_percentage integer not null default 70
    check (module_quiz_pass_percentage between 0 and 100),

  topic_questions_per_attempt integer not null default 5
    check (topic_questions_per_attempt > 0),

  module_questions_per_attempt integer not null default 12
    check (module_questions_per_attempt > 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (roadmap_version_id, module_key),
  unique (roadmap_version_id, sort_order),
  unique (id, roadmap_version_id)
);


-- ---------------------------------------------------------
-- 4. Module Prerequisites
-- ---------------------------------------------------------

create table if not exists public.roadmap_module_prerequisites (
  roadmap_version_id uuid not null,

  roadmap_module_id uuid not null,
  prerequisite_module_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (
    roadmap_module_id,
    prerequisite_module_id
  ),

  check (roadmap_module_id <> prerequisite_module_id),

  foreign key (roadmap_module_id, roadmap_version_id)
    references public.roadmap_modules(id, roadmap_version_id)
    on delete cascade,

  foreign key (prerequisite_module_id, roadmap_version_id)
    references public.roadmap_modules(id, roadmap_version_id)
    on delete cascade
);


-- ---------------------------------------------------------
-- 5. Versioned Roadmap Topics
-- ---------------------------------------------------------

-- learning_topics remains the legacy identity used by the
-- existing placement assessment and student_topic_mastery.
-- legacy_topic_id connects the new versioned topic to it.

create table if not exists public.roadmap_topics (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null,
  roadmap_module_id uuid not null,

  legacy_topic_id uuid
    references public.learning_topics(id) on delete set null,

  topic_key text not null,
  slug text not null,

  title text not null,
  description text not null default '',

  sort_order integer not null check (sort_order > 0),

  objectives text[] not null default '{}',
  estimated_duration text not null default '',

  pass_percentage integer not null default 70
    check (pass_percentage between 0 and 100),

  questions_per_attempt integer not null default 5
    check (questions_per_attempt > 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (roadmap_module_id, roadmap_version_id)
    references public.roadmap_modules(id, roadmap_version_id)
    on delete cascade,

  unique (roadmap_version_id, topic_key),
  unique (roadmap_module_id, sort_order),
  unique (id, roadmap_version_id)
);

create unique index if not exists
  roadmap_topics_legacy_mapping_idx
on public.roadmap_topics (
  roadmap_version_id,
  legacy_topic_id
)
where legacy_topic_id is not null;


-- ---------------------------------------------------------
-- 6. Lessons
-- ---------------------------------------------------------

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null,
  roadmap_topic_id uuid not null,

  lesson_key text not null,

  title text not null,
  description text not null default '',

  objectives text[] not null default '{}',

  sort_order integer not null check (sort_order > 0),

  is_required boolean not null default true,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (roadmap_topic_id, roadmap_version_id)
    references public.roadmap_topics(id, roadmap_version_id)
    on delete cascade,

  unique (roadmap_topic_id, lesson_key),
  unique (roadmap_topic_id, sort_order),
  unique (id, roadmap_version_id)
);


-- ---------------------------------------------------------
-- 7. Learning Resources
-- ---------------------------------------------------------

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null,
  lesson_id uuid not null,

  resource_key text not null,

  title text not null,

  resource_type text not null
    check (
      resource_type in (
        'youtube_video',
        'documentation',
        'article',
        'external_course',
        'practice',
        'interactive',
        'pdf'
      )
    ),

  url text not null,

  provider text not null default '',
  description text not null default '',

  language text not null default 'en'
    check (language in ('en', 'ar', 'other')),

  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),

  is_required boolean not null default true,
  sort_order integer not null check (sort_order > 0),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (lesson_id, roadmap_version_id)
    references public.learning_lessons(id, roadmap_version_id)
    on delete cascade,

  unique (lesson_id, resource_key),
  unique (lesson_id, sort_order),

  check (url ~ '^https?://')
);


-- ---------------------------------------------------------
-- 8. Topic Quiz Question Bank
-- ---------------------------------------------------------

create table if not exists public.topic_quiz_questions (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null,
  roadmap_topic_id uuid not null,

  question_key text not null,
  question_version integer not null default 1
    check (question_version > 0),

  prompt text not null,

  question_type text not null default 'knowledge'
    check (
      question_type in ('knowledge', 'scenario', 'application')
    ),

  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),

  learning_objective text not null default '',

  options jsonb not null,

  correct_option_id text not null,

  explanation text not null default '',

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (roadmap_topic_id, roadmap_version_id)
    references public.roadmap_topics(id, roadmap_version_id)
    on delete cascade,

  unique (
    roadmap_topic_id,
    question_key,
    question_version
  ),

  check (
    case
      when jsonb_typeof(options) = 'array'
      then jsonb_array_length(options) = 4
      else false
    end
  ),

  check (
    options @> jsonb_build_array(
      jsonb_build_object('id', correct_option_id)
    )
  )
);


-- ---------------------------------------------------------
-- 9. Module Quiz Question Bank
-- ---------------------------------------------------------

create table if not exists public.module_quiz_questions (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null,
  roadmap_module_id uuid not null,

  -- Optional coverage mapping:
  -- identifies which topic this question evaluates.
  roadmap_topic_id uuid,

  question_key text not null,
  question_version integer not null default 1
    check (question_version > 0),

  prompt text not null,

  question_type text not null default 'knowledge'
    check (
      question_type in ('knowledge', 'scenario', 'application')
    ),

  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),

  learning_objective text not null default '',

  options jsonb not null,
  correct_option_id text not null,

  explanation text not null default '',

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (roadmap_module_id, roadmap_version_id)
    references public.roadmap_modules(id, roadmap_version_id)
    on delete cascade,

  foreign key (roadmap_topic_id, roadmap_version_id)
    references public.roadmap_topics(id, roadmap_version_id)
    on delete set null,

  unique (
    roadmap_module_id,
    question_key,
    question_version
  ),

  check (
    case
      when jsonb_typeof(options) = 'array'
      then jsonb_array_length(options) = 4
      else false
    end
  ),

  check (
    options @> jsonb_build_array(
      jsonb_build_object('id', correct_option_id)
    )
  )
);


-- ---------------------------------------------------------
-- 10. Student Roadmap Enrollments
-- ---------------------------------------------------------

create table if not exists public.roadmap_enrollments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  track_id uuid not null,

  roadmap_version_id uuid not null,

  starting_module_id uuid,
  starting_topic_id uuid,

  status text not null default 'active'
    check (status in ('active', 'completed', 'paused')),

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (roadmap_version_id, track_id)
    references public.roadmap_versions(id, track_id)
    on delete restrict,

  foreign key (starting_module_id, roadmap_version_id)
    references public.roadmap_modules(id, roadmap_version_id)
    on delete set null,

  foreign key (starting_topic_id, roadmap_version_id)
    references public.roadmap_topics(id, roadmap_version_id)
    on delete set null,

  unique (id, user_id)
);

create unique index if not exists
  roadmap_enrollments_one_active_track_idx
on public.roadmap_enrollments (user_id, track_id)
where status = 'active';


-- ---------------------------------------------------------
-- 11. Topic Quiz Attempts
-- ---------------------------------------------------------

create table if not exists public.topic_quiz_attempts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  enrollment_id uuid not null
    references public.roadmap_enrollments(id) on delete restrict,

  roadmap_version_id uuid not null,
  roadmap_topic_id uuid not null,

  score integer not null
    check (score between 0 and 100),

  correct_count integer not null
    check (correct_count >= 0),

  total_questions integer not null
    check (total_questions > 0),

  passed boolean not null,

  created_at timestamptz not null default now(),

  foreign key (roadmap_topic_id, roadmap_version_id)
    references public.roadmap_topics(id, roadmap_version_id)
    on delete restrict
);

create index if not exists
  topic_quiz_attempts_user_created_idx
on public.topic_quiz_attempts (user_id, created_at desc);


-- ---------------------------------------------------------
-- 12. Immutable Topic Quiz Question Snapshots
-- ---------------------------------------------------------

create table if not exists public.topic_quiz_attempt_snapshots (
  id uuid primary key default gen_random_uuid(),

  attempt_id uuid not null
    references public.topic_quiz_attempts(id) on delete cascade,

  user_id uuid not null
    references auth.users(id) on delete cascade,

  question_id uuid not null,
  question_version integer not null,

  question_order integer not null
    check (question_order > 0),

  prompt_snapshot text not null,
  options_snapshot jsonb not null,

  selected_option_id text not null,
  correct_option_id text not null,

  explanation_snapshot text not null default '',

  created_at timestamptz not null default now(),

  unique (attempt_id, question_id),

  check (jsonb_typeof(options_snapshot) = 'array')
);

create index if not exists
  topic_quiz_snapshots_attempt_idx
on public.topic_quiz_attempt_snapshots (
  attempt_id,
  question_order
);


-- ---------------------------------------------------------
-- 13. Student Topic Progress
-- ---------------------------------------------------------

create table if not exists public.student_topic_progress (
  user_id uuid not null
    references auth.users(id) on delete cascade,

  enrollment_id uuid not null,

  roadmap_version_id uuid not null,
  roadmap_topic_id uuid not null,

  status text not null
    check (status in ('validated', 'completed')),

  verification_source text not null
    check (
      verification_source in (
        'placement_assessment',
        'topic_quiz'
      )
    ),

  score integer
    check (score between 0 and 100),

  verified_at timestamptz not null default now(),

  last_attempt_id uuid
    references public.topic_quiz_attempts(id) on delete set null,

  updated_at timestamptz not null default now(),

  primary key (user_id, roadmap_topic_id),

  foreign key (roadmap_topic_id, roadmap_version_id)
    references public.roadmap_topics(id, roadmap_version_id)
    on delete cascade,

  foreign key (enrollment_id, user_id)
    references public.roadmap_enrollments(id, user_id)
    on delete cascade
);


-- ---------------------------------------------------------
-- 14. Preserve Version Information on Existing Module Attempts
-- ---------------------------------------------------------

alter table public.quiz_attempts
  add column if not exists roadmap_version_id uuid
  references public.roadmap_versions(id) on delete set null;

alter table public.quiz_attempts
  add column if not exists roadmap_module_id uuid
  references public.roadmap_modules(id) on delete set null;

alter table public.quiz_attempt_question_snapshots
  add column if not exists roadmap_version_id uuid
  references public.roadmap_versions(id) on delete set null;

alter table public.quiz_attempt_question_snapshots
  add column if not exists roadmap_module_id uuid
  references public.roadmap_modules(id) on delete set null;


-- ---------------------------------------------------------
-- 15. Indexes
-- ---------------------------------------------------------

create index if not exists
  roadmap_modules_version_order_idx
on public.roadmap_modules (
  roadmap_version_id,
  sort_order
);

create index if not exists
  roadmap_topics_module_order_idx
on public.roadmap_topics (
  roadmap_module_id,
  sort_order
);

create index if not exists
  learning_lessons_topic_order_idx
on public.learning_lessons (
  roadmap_topic_id,
  sort_order
);

create index if not exists
  learning_resources_lesson_order_idx
on public.learning_resources (
  lesson_id,
  sort_order
);

create index if not exists
  topic_quiz_questions_active_idx
on public.topic_quiz_questions (
  roadmap_topic_id,
  is_active,
  difficulty
);

create index if not exists
  module_quiz_questions_active_idx
on public.module_quiz_questions (
  roadmap_module_id,
  is_active,
  difficulty
);

create index if not exists
  student_topic_progress_user_idx
on public.student_topic_progress (
  user_id,
  updated_at desc
);


-- ---------------------------------------------------------
-- 16. Enable RLS
-- ---------------------------------------------------------

alter table public.learning_tracks enable row level security;
alter table public.roadmap_versions enable row level security;
alter table public.roadmap_modules enable row level security;
alter table public.roadmap_module_prerequisites enable row level security;
alter table public.roadmap_topics enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.learning_resources enable row level security;

alter table public.topic_quiz_questions enable row level security;
alter table public.module_quiz_questions enable row level security;

alter table public.roadmap_enrollments enable row level security;
alter table public.topic_quiz_attempts enable row level security;
alter table public.topic_quiz_attempt_snapshots enable row level security;
alter table public.student_topic_progress enable row level security;


-- ---------------------------------------------------------
-- 17. Client Privileges
-- ---------------------------------------------------------

-- Revoke client writes on all new tables.
revoke all on table
  public.learning_tracks,
  public.roadmap_versions,
  public.roadmap_modules,
  public.roadmap_module_prerequisites,
  public.roadmap_topics,
  public.learning_lessons,
  public.learning_resources,
  public.topic_quiz_questions,
  public.module_quiz_questions,
  public.roadmap_enrollments,
  public.topic_quiz_attempts,
  public.topic_quiz_attempt_snapshots,
  public.student_topic_progress
from public, anon, authenticated;

-- Published content may be read by students and visitors.
grant select on
  public.learning_tracks,
  public.roadmap_versions,
  public.roadmap_modules,
  public.roadmap_module_prerequisites,
  public.roadmap_topics,
  public.learning_lessons,
  public.learning_resources
to anon, authenticated;

-- Students can read their own enrollment and progress.
grant select on
  public.roadmap_enrollments,
  public.topic_quiz_attempts,
  public.student_topic_progress
to authenticated;

-- Question banks and answer keys stay server-only.
-- Snapshot tables stay server-only as well.
grant all on table
  public.learning_tracks,
  public.roadmap_versions,
  public.roadmap_modules,
  public.roadmap_module_prerequisites,
  public.roadmap_topics,
  public.learning_lessons,
  public.learning_resources,
  public.topic_quiz_questions,
  public.module_quiz_questions,
  public.roadmap_enrollments,
  public.topic_quiz_attempts,
  public.topic_quiz_attempt_snapshots,
  public.student_topic_progress
to service_role;


-- ---------------------------------------------------------
-- 18. Public Policies: Published Content Only
-- ---------------------------------------------------------

drop policy if exists roadmap_tracks_public_read
  on public.learning_tracks;

create policy roadmap_tracks_public_read
on public.learning_tracks
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.roadmap_versions rv
    where rv.track_id = learning_tracks.id
      and rv.status = 'published'
  )
);


drop policy if exists roadmap_versions_public_read
  on public.roadmap_versions;

create policy roadmap_versions_public_read
on public.roadmap_versions
for select
to anon, authenticated
using (status = 'published');


drop policy if exists roadmap_modules_public_read
  on public.roadmap_modules;

create policy roadmap_modules_public_read
on public.roadmap_modules
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.roadmap_versions rv
    where rv.id = roadmap_modules.roadmap_version_id
      and rv.status = 'published'
  )
);


drop policy if exists roadmap_prerequisites_public_read
  on public.roadmap_module_prerequisites;

create policy roadmap_prerequisites_public_read
on public.roadmap_module_prerequisites
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.roadmap_versions rv
    where rv.id = roadmap_module_prerequisites.roadmap_version_id
      and rv.status = 'published'
  )
);


drop policy if exists roadmap_topics_public_read
  on public.roadmap_topics;

create policy roadmap_topics_public_read
on public.roadmap_topics
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.roadmap_versions rv
    where rv.id = roadmap_topics.roadmap_version_id
      and rv.status = 'published'
  )
);


drop policy if exists roadmap_lessons_public_read
  on public.learning_lessons;

create policy roadmap_lessons_public_read
on public.learning_lessons
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.roadmap_topics rt
    join public.roadmap_versions rv
      on rv.id = rt.roadmap_version_id
    where rt.id = learning_lessons.roadmap_topic_id
      and rt.is_active = true
      and rv.status = 'published'
  )
);


drop policy if exists roadmap_resources_public_read
  on public.learning_resources;

create policy roadmap_resources_public_read
on public.learning_resources
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.learning_lessons ll
    join public.roadmap_topics rt
      on rt.id = ll.roadmap_topic_id
    join public.roadmap_versions rv
      on rv.id = rt.roadmap_version_id
    where ll.id = learning_resources.lesson_id
      and ll.is_active = true
      and rt.is_active = true
      and rv.status = 'published'
  )
);


-- ---------------------------------------------------------
-- 19. Private Student Policies
-- ---------------------------------------------------------

drop policy if exists roadmap_enrollments_select_own
  on public.roadmap_enrollments;

create policy roadmap_enrollments_select_own
on public.roadmap_enrollments
for select
to authenticated
using (user_id = (select auth.uid()));


drop policy if exists topic_quiz_attempts_select_own
  on public.topic_quiz_attempts;

create policy topic_quiz_attempts_select_own
on public.topic_quiz_attempts
for select
to authenticated
using (user_id = (select auth.uid()));


drop policy if exists student_topic_progress_select_own
  on public.student_topic_progress;

create policy student_topic_progress_select_own
on public.student_topic_progress
for select
to authenticated
using (user_id = (select auth.uid()));


-- No client policy or grant for:
-- topic_quiz_questions
-- module_quiz_questions
-- topic_quiz_attempt_snapshots
--
-- Admin and server actions use service_role after checking
-- the user's role on the server.


-- ---------------------------------------------------------
-- 20. Seed Full-Stack Development Track as Draft v1
-- ---------------------------------------------------------

do $$
declare
  v_track_id uuid;
  v_version_id uuid;
begin

  insert into public.learning_tracks (
    slug,
    title,
    description,
    is_active
  )
  values (
    'full-stack-development',
    'Full-Stack Development',
    'A structured learning path from web fundamentals to building and deploying full-stack applications.',
    true
  )
  on conflict (slug) do nothing;

  select id
  into v_track_id
  from public.learning_tracks
  where slug = 'full-stack-development';

  insert into public.roadmap_versions (
    track_id,
    version_number,
    status,
    change_summary
  )
  values (
    v_track_id,
    1,
    'draft',
    'Initial database-backed Full-Stack roadmap.'
  )
  on conflict (track_id, version_number) do nothing;

  select id
  into v_version_id
  from public.roadmap_versions
  where track_id = v_track_id
    and version_number = 1;


  -- Existing ten modules, migrated as the initial draft structure.
  insert into public.roadmap_modules (
    roadmap_version_id,
    module_key,
    sort_order,
    title,
    description,
    estimated_duration,
    skills
  )
  values
    (
      v_version_id,
      'web-fundamentals',
      1,
      'Web Fundamentals',
      'Understand how the web works, browsers communicate, and websites are delivered.',
      '1 week',
      array['HTTP', 'DNS', 'Browser basics']
    ),
    (
      v_version_id,
      'html-css',
      2,
      'HTML & CSS',
      'Build accessible, responsive web pages with semantic HTML and modern CSS.',
      '2 weeks',
      array['HTML', 'CSS', 'Responsive design']
    ),
    (
      v_version_id,
      'javascript',
      3,
      'JavaScript',
      'Learn programming fundamentals and build interactive browser experiences.',
      '3 weeks',
      array['ES6+', 'DOM', 'Async JavaScript']
    ),
    (
      v_version_id,
      'git-github',
      4,
      'Git & GitHub',
      'Track code changes and collaborate using a professional version-control workflow.',
      '1 week',
      array['Git', 'Branches', 'Pull workflow']
    ),
    (
      v_version_id,
      'react',
      5,
      'React',
      'Build reusable user interfaces with components, state, and modern React patterns.',
      '3 weeks',
      array['Components', 'Hooks', 'Forms']
    ),
    (
      v_version_id,
      'node-express',
      6,
      'Node.js & Express',
      'Create server-side applications and REST APIs.',
      '2 weeks',
      array['Node.js', 'REST APIs', 'Middleware']
    ),
    (
      v_version_id,
      'databases-sql',
      7,
      'Databases & SQL',
      'Model relational data and write queries that support application features.',
      '2 weeks',
      array['SQL', 'Relationships', 'Data modeling']
    ),
    (
      v_version_id,
      'auth-security',
      8,
      'Authentication & Security',
      'Protect application data and implement secure access patterns.',
      '2 weeks',
      array['Authentication', 'Authorization', 'Validation']
    ),
    (
      v_version_id,
      'testing-deployment',
      9,
      'Testing & Deployment',
      'Verify application behavior and deploy a production-ready application.',
      '2 weeks',
      array['Testing', 'CI basics', 'Deployment']
    ),
    (
      v_version_id,
      'final-project',
      10,
      'Final Full-Stack Project',
      'Combine frontend, backend, data, security, and deployment into one complete product.',
      '3 weeks',
      array['System design', 'Integration', 'Delivery']
    )
  on conflict (roadmap_version_id, module_key) do nothing;


  -- Existing prerequisite graph.
  insert into public.roadmap_module_prerequisites (
    roadmap_version_id,
    roadmap_module_id,
    prerequisite_module_id
  )
  select
    v_version_id,
    current_module.id,
    prerequisite_module.id
  from (
    values
      ('html-css', 'web-fundamentals'),
      ('javascript', 'html-css'),
      ('git-github', 'javascript'),
      ('react', 'javascript'),
      ('react', 'git-github'),
      ('node-express', 'react'),
      ('databases-sql', 'node-express'),
      ('auth-security', 'databases-sql'),
      ('testing-deployment', 'auth-security'),
      ('final-project', 'testing-deployment')
  ) as dependencies(module_key, prerequisite_key)
  join public.roadmap_modules current_module
    on current_module.roadmap_version_id = v_version_id
    and current_module.module_key = dependencies.module_key
  join public.roadmap_modules prerequisite_module
    on prerequisite_module.roadmap_version_id = v_version_id
    and prerequisite_module.module_key = dependencies.prerequisite_key
  on conflict do nothing;


  -- Migrate the existing topic catalog into the first roadmap version.
  -- Placement question banks and historical mastery remain attached
  -- to their original learning_topics IDs.
  insert into public.roadmap_topics (
    roadmap_version_id,
    roadmap_module_id,
    legacy_topic_id,
    topic_key,
    slug,
    title,
    description,
    sort_order
  )
  select
    v_version_id,
    rm.id,
    lt.id,
    lt.module_id || ':' || lt.slug,
    lt.slug,
    lt.title,
    lt.description,
    greatest(lt.sort_order, 1)
  from public.learning_topics lt
  join public.roadmap_modules rm
    on rm.roadmap_version_id = v_version_id
    and rm.module_key = lt.module_id
  on conflict (roadmap_version_id, topic_key) do nothing;

end;
$$;


-- ---------------------------------------------------------
-- 21. Finalize
-- ---------------------------------------------------------

commit;

-- The initial Full-Stack version intentionally remains DRAFT.
-- Existing student routes continue using the current implementation
-- until the new database-backed experience is connected and tested.
