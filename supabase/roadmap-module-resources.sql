-- =========================================================
-- MASARAK: Separate Module-wide Resources Table
-- Phase 3D / 3E Hardening
--
-- Module resources are general materials for an entire module,
-- distinct from lesson-specific learning resources.
-- Run after roadmap-content.sql in Supabase SQL Editor.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0. Verify required parent table exists
-- ---------------------------------------------------------

do $$
begin
  if to_regclass('public.roadmap_modules') is null then
    raise exception
      'Missing public.roadmap_modules. Run roadmap-content.sql first.';
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1. Create roadmap_module_resources table
-- ---------------------------------------------------------

create table if not exists public.roadmap_module_resources (
  id uuid primary key default gen_random_uuid(),

  roadmap_version_id uuid not null,
  roadmap_module_id uuid not null,

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

  foreign key (roadmap_module_id, roadmap_version_id)
    references public.roadmap_modules(id, roadmap_version_id)
    on delete cascade,

  unique (roadmap_module_id, resource_key),
  unique (roadmap_module_id, sort_order),
  unique (id, roadmap_version_id),

  check (url ~ '^https?://')
);

-- ---------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------

create index if not exists
  roadmap_module_resources_module_order_idx
on public.roadmap_module_resources (
  roadmap_module_id,
  sort_order
);

create index if not exists
  roadmap_module_resources_version_active_idx
on public.roadmap_module_resources (
  roadmap_version_id,
  is_active
);

-- ---------------------------------------------------------
-- 3. Enable RLS
-- ---------------------------------------------------------

alter table public.roadmap_module_resources enable row level security;

-- ---------------------------------------------------------
-- 4. Privileges
-- ---------------------------------------------------------

revoke all on table public.roadmap_module_resources from public, anon, authenticated;

grant select on public.roadmap_module_resources to anon, authenticated;
grant all on table public.roadmap_module_resources to service_role;

-- ---------------------------------------------------------
-- 5. Policies: Published content read only
-- ---------------------------------------------------------

drop policy if exists roadmap_module_resources_public_read
  on public.roadmap_module_resources;

create policy roadmap_module_resources_public_read
on public.roadmap_module_resources
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.roadmap_modules rm
    join public.roadmap_versions rv
      on rv.id = rm.roadmap_version_id
    where rm.id = roadmap_module_resources.roadmap_module_id
      and rm.is_active = true
      and rv.status = 'published'
  )
);

commit;
