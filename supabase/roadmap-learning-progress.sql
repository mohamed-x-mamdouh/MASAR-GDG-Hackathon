
-- =========================================================
-- MASARAK: Versioned Student Progress & Learning Access
-- Phase 3B
--
-- Adds version-aware progress for:
-- - Lessons
-- - Topics
-- - Modules
--
-- Preserves legacy progress, placement and quiz history.
-- Run after roadmap-content.sql.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0. Verify dependencies
-- ---------------------------------------------------------

do $$
begin
  if to_regclass('public.roadmap_enrollments') is null
     or to_regclass('public.roadmap_modules') is null
     or to_regclass('public.roadmap_topics') is null
     or to_regclass('public.learning_lessons') is null
     or to_regclass('public.student_topic_progress') is null
     or to_regclass('public.topic_quiz_attempts') is null
     or to_regclass('public.quiz_attempts') is null then
    raise exception
      'Roadmap content foundation is missing. Run roadmap-content.sql first.';
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 1. Version-aware enrollment reference
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'roadmap_enrollments_id_user_version_uk'
      and conrelid = 'public.roadmap_enrollments'::regclass
  ) then
    alter table public.roadmap_enrollments
      add constraint roadmap_enrollments_id_user_version_uk
      unique (id, user_id, roadmap_version_id);
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 2. Extend legacy module quiz attempts
-- ---------------------------------------------------------

alter table public.quiz_attempts
  add column if not exists enrollment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_version_context_check'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_version_context_check
      check (
        (
          enrollment_id is null
          and roadmap_version_id is null
          and roadmap_module_id is null
        )
        or
        (
          enrollment_id is not null
          and roadmap_version_id is not null
          and roadmap_module_id is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_versioned_reference_uk'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_versioned_reference_uk
      unique (
        id,
        user_id,
        enrollment_id,
        roadmap_version_id,
        roadmap_module_id
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_enrollment_version_fk'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_enrollment_version_fk
      foreign key (
        enrollment_id,
        user_id,
        roadmap_version_id
      )
      references public.roadmap_enrollments (
        id,
        user_id,
        roadmap_version_id
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_module_version_fk'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_module_version_fk
      foreign key (roadmap_module_id, roadmap_version_id)
      references public.roadmap_modules (id, roadmap_version_id);
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 3. Version-aware student module progress
-- ---------------------------------------------------------

create table if not exists public.student_module_progress (
  user_id uuid not null
    references auth.users(id) on delete cascade,

  enrollment_id uuid not null,
  roadmap_version_id uuid not null,
  roadmap_module_id uuid not null,

  status text not null
    check (status in ('validated', 'completed')),

  verification_source text not null
    check (
      verification_source in (
        'placement_assessment',
        'module_quiz'
      )
    ),

  score integer
    check (score between 0 and 100),

  last_quiz_attempt_id uuid,

  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (enrollment_id, roadmap_module_id),

  foreign key (
    enrollment_id,
    user_id,
    roadmap_version_id
  )
    references public.roadmap_enrollments (
      id,
      user_id,
      roadmap_version_id
    )
    on delete cascade,

  foreign key (roadmap_module_id, roadmap_version_id)
    references public.roadmap_modules (id, roadmap_version_id)
    on delete restrict,

  check (
    (status = 'validated'
      and verification_source = 'placement_assessment')
    or
    (status = 'completed'
      and verification_source = 'module_quiz')
  ),

  foreign key (
    last_quiz_attempt_id,
    user_id,
    enrollment_id,
    roadmap_version_id,
    roadmap_module_id
  )
    references public.quiz_attempts (
      id,
      user_id,
      enrollment_id,
      roadmap_version_id,
      roadmap_module_id
    )
);

create index if not exists student_module_progress_user_idx
  on public.student_module_progress (user_id, updated_at desc);


-- ---------------------------------------------------------
-- 4. Student lesson progress
-- ---------------------------------------------------------

create table if not exists public.student_lesson_progress (
  user_id uuid not null
    references auth.users(id) on delete cascade,

  enrollment_id uuid not null,
  roadmap_version_id uuid not null,
  lesson_id uuid not null,

  completed_at timestamptz not null default now(),

  primary key (enrollment_id, lesson_id),

  foreign key (
    enrollment_id,
    user_id,
    roadmap_version_id
  )
    references public.roadmap_enrollments (
      id,
      user_id,
      roadmap_version_id
    )
    on delete cascade,

  foreign key (lesson_id, roadmap_version_id)
    references public.learning_lessons (id, roadmap_version_id)
    on delete cascade
);

create index if not exists student_lesson_progress_user_idx
  on public.student_lesson_progress (user_id, completed_at desc);


-- ---------------------------------------------------------
-- 5. Strengthen topic quiz attempt relationships
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'topic_quiz_attempts_versioned_reference_uk'
      and conrelid = 'public.topic_quiz_attempts'::regclass
  ) then
    alter table public.topic_quiz_attempts
      add constraint topic_quiz_attempts_versioned_reference_uk
      unique (
        id,
        user_id,
        enrollment_id,
        roadmap_version_id,
        roadmap_topic_id
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'topic_quiz_attempts_enrollment_version_fk'
      and conrelid = 'public.topic_quiz_attempts'::regclass
  ) then
    alter table public.topic_quiz_attempts
      add constraint topic_quiz_attempts_enrollment_version_fk
      foreign key (
        enrollment_id,
        user_id,
        roadmap_version_id
      )
      references public.roadmap_enrollments (
        id,
        user_id,
        roadmap_version_id
      )
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'topic_quiz_attempts_count_check'
      and conrelid = 'public.topic_quiz_attempts'::regclass
  ) then
    alter table public.topic_quiz_attempts
      add constraint topic_quiz_attempts_count_check
      check (
        correct_count <= total_questions
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_topic_progress_versioned_attempt_fk'
      and conrelid = 'public.student_topic_progress'::regclass
  ) then
    alter table public.student_topic_progress
      add constraint student_topic_progress_versioned_attempt_fk
      foreign key (
        last_attempt_id,
        user_id,
        enrollment_id,
        roadmap_version_id,
        roadmap_topic_id
      )
      references public.topic_quiz_attempts (
        id,
        user_id,
        enrollment_id,
        roadmap_version_id,
        roadmap_topic_id
      );
  end if;
end;
$$;


-- ---------------------------------------------------------
-- 6. Protect student progress tables
-- ---------------------------------------------------------

alter table public.student_module_progress
  enable row level security;

alter table public.student_lesson_progress
  enable row level security;

revoke all on table
  public.student_module_progress,
  public.student_lesson_progress
from public, anon, authenticated;

grant select on
  public.student_module_progress,
  public.student_lesson_progress
to authenticated;

grant all on table
  public.student_module_progress,
  public.student_lesson_progress
to service_role;

drop policy if exists student_module_progress_select_own
  on public.student_module_progress;

create policy student_module_progress_select_own
on public.student_module_progress
for select
to authenticated
using (user_id = (select auth.uid()));


drop policy if exists student_lesson_progress_select_own
  on public.student_lesson_progress;

create policy student_lesson_progress_select_own
on public.student_lesson_progress
for select
to authenticated
using (user_id = (select auth.uid()));


-- ---------------------------------------------------------
-- 7. Module access check
-- ---------------------------------------------------------

create or replace function public.is_roadmap_module_unlocked(
  p_user_id uuid,
  p_enrollment_id uuid,
  p_module_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
begin
  select e.roadmap_version_id
  into v_version_id
  from public.roadmap_enrollments e
  where e.id = p_enrollment_id
    and e.user_id = p_user_id
    and e.status = 'active';

  if not found then
    return false;
  end if;

  if not exists (
    select 1
    from public.roadmap_modules m
    where m.id = p_module_id
      and m.roadmap_version_id = v_version_id
      and m.is_active = true
  ) then
    return false;
  end if;

  -- Every prerequisite module must be verified.
  return not exists (
    select 1
    from public.roadmap_module_prerequisites p
    where p.roadmap_version_id = v_version_id
      and p.roadmap_module_id = p_module_id
      and not exists (
        select 1
        from public.student_module_progress mp
        where mp.user_id = p_user_id
          and mp.enrollment_id = p_enrollment_id
          and mp.roadmap_version_id = v_version_id
          and mp.roadmap_module_id = p.prerequisite_module_id
          and mp.status in ('completed', 'validated')
      )
  );
end;
$$;


-- ---------------------------------------------------------
-- 8. Topic access check
-- ---------------------------------------------------------

create or replace function public.is_roadmap_topic_unlocked(
  p_user_id uuid,
  p_enrollment_id uuid,
  p_topic_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_module_id uuid;
  v_sort_order integer;
begin
  select
    t.roadmap_version_id,
    t.roadmap_module_id,
    t.sort_order
  into
    v_version_id,
    v_module_id,
    v_sort_order
  from public.roadmap_topics t
  where t.id = p_topic_id
    and t.is_active = true;

  if not found then
    return false;
  end if;

  -- The parent module must be unlocked.
  if not public.is_roadmap_module_unlocked(
    p_user_id,
    p_enrollment_id,
    v_module_id
  ) then
    return false;
  end if;

  -- Every earlier active topic must be completed or validated.
  return not exists (
    select 1
    from public.roadmap_topics previous_topic
    where previous_topic.roadmap_version_id = v_version_id
      and previous_topic.roadmap_module_id = v_module_id
      and previous_topic.is_active = true
      and previous_topic.sort_order < v_sort_order
      and not exists (
        select 1
        from public.student_topic_progress tp
        where tp.user_id = p_user_id
          and tp.enrollment_id = p_enrollment_id
          and tp.roadmap_version_id = v_version_id
          and tp.roadmap_topic_id = previous_topic.id
          and tp.status in ('completed', 'validated')
      )
  );
end;
$$;


-- ---------------------------------------------------------
-- 9. Topic quiz access check
-- ---------------------------------------------------------

create or replace function public.is_roadmap_topic_quiz_unlocked(
  p_user_id uuid,
  p_enrollment_id uuid,
  p_topic_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_roadmap_topic_unlocked(
    p_user_id,
    p_enrollment_id,
    p_topic_id
  ) then
    return false;
  end if;

  -- A topic must contain at least one required active lesson.
  if not exists (
    select 1
    from public.learning_lessons l
    where l.roadmap_topic_id = p_topic_id
      and l.is_active = true
      and l.is_required = true
  ) then
    return false;
  end if;

  -- All required active lessons must be completed.
  return not exists (
    select 1
    from public.learning_lessons l
    where l.roadmap_topic_id = p_topic_id
      and l.is_active = true
      and l.is_required = true
      and not exists (
        select 1
        from public.student_lesson_progress lp
        where lp.user_id = p_user_id
          and lp.enrollment_id = p_enrollment_id
          and lp.roadmap_version_id = l.roadmap_version_id
          and lp.lesson_id = l.id
      )
  );
end;
$$;


-- ---------------------------------------------------------
-- 10. Module quiz access check
-- ---------------------------------------------------------

create or replace function public.is_roadmap_module_quiz_unlocked(
  p_user_id uuid,
  p_enrollment_id uuid,
  p_module_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
begin
  select e.roadmap_version_id
  into v_version_id
  from public.roadmap_enrollments e
  where e.id = p_enrollment_id
    and e.user_id = p_user_id
    and e.status = 'active';

  if not found then
    return false;
  end if;

  if not public.is_roadmap_module_unlocked(
    p_user_id,
    p_enrollment_id,
    p_module_id
  ) then
    return false;
  end if;

  -- Require at least one active topic.
  if not exists (
    select 1
    from public.roadmap_topics t
    where t.roadmap_version_id = v_version_id
      and t.roadmap_module_id = p_module_id
      and t.is_active = true
  ) then
    return false;
  end if;

  -- Every active topic must be completed or validated.
  return not exists (
    select 1
    from public.roadmap_topics t
    where t.roadmap_version_id = v_version_id
      and t.roadmap_module_id = p_module_id
      and t.is_active = true
      and not exists (
        select 1
        from public.student_topic_progress tp
        where tp.user_id = p_user_id
          and tp.enrollment_id = p_enrollment_id
          and tp.roadmap_version_id = v_version_id
          and tp.roadmap_topic_id = t.id
          and tp.status in ('completed', 'validated')
      )
  );
end;
$$;


-- ---------------------------------------------------------
-- 11. RPC permissions
-- ---------------------------------------------------------

revoke all on function public.is_roadmap_module_unlocked(
  uuid, uuid, uuid
) from public, anon, authenticated;

revoke all on function public.is_roadmap_topic_unlocked(
  uuid, uuid, uuid
) from public, anon, authenticated;

revoke all on function public.is_roadmap_topic_quiz_unlocked(
  uuid, uuid, uuid
) from public, anon, authenticated;

revoke all on function public.is_roadmap_module_quiz_unlocked(
  uuid, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.is_roadmap_module_unlocked(
  uuid, uuid, uuid
) to service_role;

grant execute on function public.is_roadmap_topic_unlocked(
  uuid, uuid, uuid
) to service_role;

grant execute on function public.is_roadmap_topic_quiz_unlocked(
  uuid, uuid, uuid
) to service_role;

grant execute on function public.is_roadmap_module_quiz_unlocked(
  uuid, uuid, uuid
) to service_role;


commit;
