
-- =========================================================
-- MASAR: Initial database schema
-- =========================================================

-- 1. Student profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  selected_start_path text
    check (selected_start_path in ('beginner', 'placement')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Verified module progress
create table public.module_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  status text not null
    check (status in ('completed', 'validated')),
  verification_source text not null
    check (verification_source in ('module_quiz', 'placement_assessment')),
  score integer check (score between 0 and 100),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, module_id),

  constraint module_progress_source_matches_status
    check (
      (status = 'completed' and verification_source = 'module_quiz')
      or
      (status = 'validated' and verification_source = 'placement_assessment')
    )
);

-- 3. Quiz attempts
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  answers jsonb not null default '{}'::jsonb,
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  created_at timestamptz not null default now()
);

-- 4. Placement assessment attempts
create table public.placement_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  cv_storage_path text,
  extracted_skills jsonb not null default '[]'::jsonb,
  skill_results jsonb not null default '{}'::jsonb,
  overall_score integer check (overall_score between 0 and 100),
  recommended_start_module_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- =========================================================
-- Indexes
-- =========================================================

create index quiz_attempts_user_created_idx
  on public.quiz_attempts (user_id, created_at desc);

create index placement_attempts_user_created_idx
  on public.placement_attempts (user_id, created_at desc);

-- =========================================================
-- Enable Row Level Security
-- =========================================================

alter table public.profiles enable row level security;
alter table public.module_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.placement_attempts enable row level security;

-- Remove default client privileges and grant only what is needed.
revoke all on table
  public.profiles,
  public.module_progress,
  public.quiz_attempts,
  public.placement_attempts
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, selected_start_path)
  on public.profiles to authenticated;

-- Students can read their own progress and results.
-- Writes will be performed by trusted server-side code.
grant select on
  public.module_progress,
  public.quiz_attempts,
  public.placement_attempts
to authenticated;

-- Server-side admin client only. Never expose its secret key.
grant all on table
  public.profiles,
  public.module_progress,
  public.quiz_attempts,
  public.placement_attempts
to service_role;

-- =========================================================
-- RLS policies
-- =========================================================

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "module_progress_select_own"
  on public.module_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "quiz_attempts_select_own"
  on public.quiz_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "placement_attempts_select_own"
  on public.placement_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================
-- Automatically create a profile when a student signs up
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', '')
    )
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
