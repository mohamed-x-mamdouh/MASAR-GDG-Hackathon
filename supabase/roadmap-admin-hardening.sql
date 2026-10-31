-- Masarak Phase 3E: atomic roadmap administration operations.
-- Apply this migration once in Supabase SQL Editor.
-- It preserves all records; archive operations are soft-archives.

begin;

-- Serialize structural writes for a given roadmap version. This prevents two
-- concurrent admins from validating different prerequisite graphs at once.

create or replace function public.create_roadmap_module_with_prerequisites(
  p_version_id uuid,
  p_module_key text,
  p_title text,
  p_description text,
  p_estimated_duration text,
  p_sort_order integer,
  p_skills text[],
  p_objectives text[],
  p_completion_criteria text[],
  p_prerequisite_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_track_slug text;
  v_module_id uuid;
  v_prerequisite_ids uuid[] := coalesce(p_prerequisite_ids, array[]::uuid[]);
  v_prerequisite_count integer;
begin
  if p_version_id is null then
    raise exception using errcode = 'P0001', message = 'Missing roadmap version.';
  end if;

  -- Lock the version row so create/update/archive graph changes are serialized.
  perform 1
  from public.roadmap_versions rv
  where rv.id = p_version_id
  for update;

  select rv.status, lt.slug
    into v_status, v_track_slug
  from public.roadmap_versions rv
  join public.learning_tracks lt on lt.id = rv.track_id
  where rv.id = p_version_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Roadmap version not found.';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft roadmap versions can be edited.';
  end if;
  if v_track_slug <> 'full-stack-development' then
    raise exception using errcode = 'P0001', message = 'This admin builder only supports the Full-Stack Development track.';
  end if;

  if coalesce(trim(p_module_key), '') = ''
     or p_module_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode = 'P0001', message = 'Module key must be URL-safe, such as react-basics.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception using errcode = 'P0001', message = 'Module title is required.';
  end if;
  if p_sort_order is null or p_sort_order < 1 then
    raise exception using errcode = 'P0001', message = 'Module order must be a positive integer.';
  end if;

  if exists (
    select 1 from unnest(v_prerequisite_ids) as requested(id) where requested.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'Prerequisite IDs cannot be empty.';
  end if;

  select count(*) into v_prerequisite_count
  from unnest(v_prerequisite_ids) as requested(id);

  if v_prerequisite_count <> (
    select count(distinct requested.id)
    from unnest(v_prerequisite_ids) as requested(id)
  ) then
    raise exception using errcode = 'P0001', message = 'Duplicate prerequisite modules were submitted.';
  end if;

  if v_prerequisite_count > 0 then
    select count(*) into v_prerequisite_count
    from public.roadmap_modules rm
    where rm.roadmap_version_id = p_version_id
      and rm.is_active = true
      and rm.id = any(v_prerequisite_ids);

    if v_prerequisite_count <> cardinality(v_prerequisite_ids) then
      raise exception using errcode = 'P0001', message = 'Choose active prerequisite modules from this roadmap version.';
    end if;
  end if;

  insert into public.roadmap_modules (
    roadmap_version_id,
    module_key,
    title,
    description,
    estimated_duration,
    sort_order,
    skills,
    objectives,
    completion_criteria,
    is_active
  ) values (
    p_version_id,
    lower(trim(p_module_key)),
    trim(p_title),
    coalesce(p_description, ''),
    coalesce(p_estimated_duration, ''),
    p_sort_order,
    coalesce(p_skills, array[]::text[]),
    coalesce(p_objectives, array[]::text[]),
    coalesce(p_completion_criteria, array[]::text[]),
    true
  )
  returning id into v_module_id;

  insert into public.roadmap_module_prerequisites (
    roadmap_version_id,
    roadmap_module_id,
    prerequisite_module_id
  )
  select p_version_id, v_module_id, requested.id
  from unnest(v_prerequisite_ids) as requested(id);

  return v_module_id;
end;
$$;

create or replace function public.update_roadmap_module_with_prerequisites(
  p_version_id uuid,
  p_module_id uuid,
  p_title text,
  p_description text,
  p_estimated_duration text,
  p_sort_order integer,
  p_skills text[],
  p_objectives text[],
  p_completion_criteria text[],
  p_prerequisite_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_track_slug text;
  v_module_active boolean;
  v_prerequisite_ids uuid[] := coalesce(p_prerequisite_ids, array[]::uuid[]);
  v_prerequisite_count integer;
  v_has_cycle boolean;
begin
  if p_version_id is null or p_module_id is null then
    raise exception using errcode = 'P0001', message = 'Missing roadmap version or module.';
  end if;

  perform 1
  from public.roadmap_versions rv
  where rv.id = p_version_id
  for update;

  select rv.status, lt.slug
    into v_status, v_track_slug
  from public.roadmap_versions rv
  join public.learning_tracks lt on lt.id = rv.track_id
  where rv.id = p_version_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Roadmap version not found.';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft roadmap versions can be edited.';
  end if;
  if v_track_slug <> 'full-stack-development' then
    raise exception using errcode = 'P0001', message = 'This admin builder only supports the Full-Stack Development track.';
  end if;

  select rm.is_active into v_module_active
  from public.roadmap_modules rm
  where rm.id = p_module_id
    and rm.roadmap_version_id = p_version_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Module not found in this roadmap version.';
  end if;
  if not v_module_active then
    raise exception using errcode = 'P0001', message = 'Archived modules cannot be edited.';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception using errcode = 'P0001', message = 'Module title is required.';
  end if;
  if p_sort_order is null or p_sort_order < 1 then
    raise exception using errcode = 'P0001', message = 'Module order must be a positive integer.';
  end if;
  if exists (
    select 1 from unnest(v_prerequisite_ids) as requested(id) where requested.id is null
  ) then
    raise exception using errcode = 'P0001', message = 'Prerequisite IDs cannot be empty.';
  end if;

  if p_module_id = any(v_prerequisite_ids) then
    raise exception using errcode = 'P0001', message = 'A module cannot be its own prerequisite.';
  end if;

  select count(*) into v_prerequisite_count
  from unnest(v_prerequisite_ids) as requested(id);

  if v_prerequisite_count <> (
    select count(distinct requested.id)
    from unnest(v_prerequisite_ids) as requested(id)
  ) then
    raise exception using errcode = 'P0001', message = 'Duplicate prerequisite modules were submitted.';
  end if;

  if v_prerequisite_count > 0 then
    select count(*) into v_prerequisite_count
    from public.roadmap_modules rm
    where rm.roadmap_version_id = p_version_id
      and rm.is_active = true
      and rm.id = any(v_prerequisite_ids);

    if v_prerequisite_count <> cardinality(v_prerequisite_ids) then
      raise exception using errcode = 'P0001', message = 'Choose active prerequisite modules from this roadmap version.';
    end if;
  end if;

  -- Edges point from a module to its prerequisites. A cycle exists when
  -- one of the newly selected prerequisites can already reach this module.
  with recursive reachable(module_id) as (
    select requested.id
    from unnest(v_prerequisite_ids) as requested(id)
    union
    select edge.prerequisite_module_id
    from reachable r
    join public.roadmap_module_prerequisites edge
      on edge.roadmap_version_id = p_version_id
     and edge.roadmap_module_id = r.module_id
    join public.roadmap_modules edge_owner
      on edge_owner.id = edge.roadmap_module_id
     and edge_owner.roadmap_version_id = edge.roadmap_version_id
     and edge_owner.is_active = true
    where edge.roadmap_module_id <> p_module_id
  )
  select exists (
    select 1 from reachable where module_id = p_module_id
  ) into v_has_cycle;

  if v_has_cycle then
    raise exception using errcode = 'P0001', message = 'These prerequisites would create a circular dependency.';
  end if;

  update public.roadmap_modules
  set title = trim(p_title),
      description = coalesce(p_description, ''),
      estimated_duration = coalesce(p_estimated_duration, ''),
      sort_order = p_sort_order,
      skills = coalesce(p_skills, array[]::text[]),
      objectives = coalesce(p_objectives, array[]::text[]),
      completion_criteria = coalesce(p_completion_criteria, array[]::text[]),
      updated_at = now()
  where id = p_module_id
    and roadmap_version_id = p_version_id;

  delete from public.roadmap_module_prerequisites
  where roadmap_version_id = p_version_id
    and roadmap_module_id = p_module_id;

  insert into public.roadmap_module_prerequisites (
    roadmap_version_id,
    roadmap_module_id,
    prerequisite_module_id
  )
  select p_version_id, p_module_id, requested.id
  from unnest(v_prerequisite_ids) as requested(id);
end;
$$;

create or replace function public.archive_roadmap_module(
  p_version_id uuid,
  p_module_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_track_slug text;
  v_module_active boolean;
begin
  perform 1 from public.roadmap_versions rv
  where rv.id = p_version_id
  for update;

  select rv.status, lt.slug into v_status, v_track_slug
  from public.roadmap_versions rv
  join public.learning_tracks lt on lt.id = rv.track_id
  where rv.id = p_version_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Roadmap version not found.';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft roadmap versions can be edited.';
  end if;
  if v_track_slug <> 'full-stack-development' then
    raise exception using errcode = 'P0001', message = 'This admin builder only supports the Full-Stack Development track.';
  end if;

  select rm.is_active into v_module_active
  from public.roadmap_modules rm
  where rm.id = p_module_id and rm.roadmap_version_id = p_version_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Module not found in this roadmap version.';
  end if;
  if not v_module_active then
    raise exception using errcode = 'P0001', message = 'This module is already archived.';
  end if;

  if exists (
    select 1
    from public.roadmap_module_prerequisites edge
    join public.roadmap_modules dependent
      on dependent.id = edge.roadmap_module_id
     and dependent.roadmap_version_id = edge.roadmap_version_id
    where edge.roadmap_version_id = p_version_id
      and edge.prerequisite_module_id = p_module_id
      and dependent.is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'Cannot archive this module while active modules depend on it. Archive or reconfigure those modules first.';
  end if;

  update public.roadmap_modules
  set is_active = false, updated_at = now()
  where id = p_module_id and roadmap_version_id = p_version_id;

  update public.roadmap_module_resources
  set is_active = false, updated_at = now()
  where roadmap_module_id = p_module_id and roadmap_version_id = p_version_id;

  update public.roadmap_topics
  set is_active = false, updated_at = now()
  where roadmap_module_id = p_module_id and roadmap_version_id = p_version_id;

  update public.learning_lessons lesson
  set is_active = false, updated_at = now()
  from public.roadmap_topics topic
  where topic.id = lesson.roadmap_topic_id
    and topic.roadmap_module_id = p_module_id
    and topic.roadmap_version_id = p_version_id;

  update public.learning_resources resource
  set is_active = false, updated_at = now()
  from public.learning_lessons lesson
  where lesson.id = resource.lesson_id
    and lesson.roadmap_version_id = p_version_id
    and lesson.roadmap_topic_id in (
      select topic.id
      from public.roadmap_topics topic
      where topic.roadmap_module_id = p_module_id
        and topic.roadmap_version_id = p_version_id
    );
end;
$$;

create or replace function public.archive_roadmap_topic(
  p_version_id uuid,
  p_topic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_track_slug text;
  v_topic_active boolean;
  v_module_active boolean;
begin
  perform 1 from public.roadmap_versions rv
  where rv.id = p_version_id
  for update;

  select rv.status, lt.slug into v_status, v_track_slug
  from public.roadmap_versions rv
  join public.learning_tracks lt on lt.id = rv.track_id
  where rv.id = p_version_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Roadmap version not found.';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft roadmap versions can be edited.';
  end if;
  if v_track_slug <> 'full-stack-development' then
    raise exception using errcode = 'P0001', message = 'This admin builder only supports the Full-Stack Development track.';
  end if;

  select topic.is_active, module.is_active
    into v_topic_active, v_module_active
  from public.roadmap_topics topic
  join public.roadmap_modules module
    on module.id = topic.roadmap_module_id
   and module.roadmap_version_id = topic.roadmap_version_id
  where topic.id = p_topic_id
    and topic.roadmap_version_id = p_version_id
  for update of topic, module;

  if not found then
    raise exception using errcode = 'P0001', message = 'Topic not found in this roadmap version.';
  end if;
  if not v_module_active then
    raise exception using errcode = 'P0001', message = 'The parent module is archived.';
  end if;
  if not v_topic_active then
    raise exception using errcode = 'P0001', message = 'This topic is already archived.';
  end if;

  update public.roadmap_topics
  set is_active = false, updated_at = now()
  where id = p_topic_id and roadmap_version_id = p_version_id;

  update public.learning_lessons
  set is_active = false, updated_at = now()
  where roadmap_topic_id = p_topic_id and roadmap_version_id = p_version_id;

  update public.learning_resources resource
  set is_active = false, updated_at = now()
  from public.learning_lessons lesson
  where lesson.id = resource.lesson_id
    and lesson.roadmap_topic_id = p_topic_id
    and lesson.roadmap_version_id = p_version_id;
end;
$$;

create or replace function public.archive_roadmap_lesson(
  p_version_id uuid,
  p_topic_id uuid,
  p_lesson_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_track_slug text;
  v_lesson_active boolean;
begin
  perform 1 from public.roadmap_versions rv
  where rv.id = p_version_id
  for update;

  select rv.status, lt.slug into v_status, v_track_slug
  from public.roadmap_versions rv
  join public.learning_tracks lt on lt.id = rv.track_id
  where rv.id = p_version_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Roadmap version not found.';
  end if;
  if v_status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft roadmap versions can be edited.';
  end if;
  if v_track_slug <> 'full-stack-development' then
    raise exception using errcode = 'P0001', message = 'This admin builder only supports the Full-Stack Development track.';
  end if;

  if not exists (
    select 1 from public.roadmap_topics topic
    join public.roadmap_modules module
      on module.id = topic.roadmap_module_id
     and module.roadmap_version_id = topic.roadmap_version_id
    where topic.id = p_topic_id
      and topic.roadmap_version_id = p_version_id
      and topic.is_active = true
      and module.is_active = true
  ) then
    raise exception using errcode = 'P0001', message = 'Active topic not found in this roadmap version.';
  end if;

  select lesson.is_active into v_lesson_active
  from public.learning_lessons lesson
  where lesson.id = p_lesson_id
    and lesson.roadmap_topic_id = p_topic_id
    and lesson.roadmap_version_id = p_version_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Lesson not found in this topic and roadmap version.';
  end if;
  if not v_lesson_active then
    raise exception using errcode = 'P0001', message = 'This lesson is already archived.';
  end if;

  update public.learning_lessons
  set is_active = false, updated_at = now()
  where id = p_lesson_id
    and roadmap_topic_id = p_topic_id
    and roadmap_version_id = p_version_id;

  update public.learning_resources
  set is_active = false, updated_at = now()
  where lesson_id = p_lesson_id
    and roadmap_version_id = p_version_id;
end;
$$;

-- The functions are intended to be called only by the server-side service-role client.
revoke all on function public.create_roadmap_module_with_prerequisites(uuid,text,text,text,text,integer,text[],text[],text[],uuid[]) from public, anon, authenticated;
revoke all on function public.update_roadmap_module_with_prerequisites(uuid,uuid,text,text,text,integer,text[],text[],text[],uuid[]) from public, anon, authenticated;
revoke all on function public.archive_roadmap_module(uuid,uuid) from public, anon, authenticated;
revoke all on function public.archive_roadmap_topic(uuid,uuid) from public, anon, authenticated;
revoke all on function public.archive_roadmap_lesson(uuid,uuid,uuid) from public, anon, authenticated;

grant execute on function public.create_roadmap_module_with_prerequisites(uuid,text,text,text,text,integer,text[],text[],text[],uuid[]) to service_role;
grant execute on function public.update_roadmap_module_with_prerequisites(uuid,uuid,text,text,text,integer,text[],text[],text[],uuid[]) to service_role;
grant execute on function public.archive_roadmap_module(uuid,uuid) to service_role;
grant execute on function public.archive_roadmap_topic(uuid,uuid) to service_role;
grant execute on function public.archive_roadmap_lesson(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';

commit;
