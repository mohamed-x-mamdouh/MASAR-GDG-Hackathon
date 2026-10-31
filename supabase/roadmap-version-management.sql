-- Masarak: clone a published roadmap into a new draft and preserve

-- enrolled-student access to archived roadmap versions.

-- Apply after the existing roadmap content and module-resource SQL.

begin;

create or replace function public.clone_published_roadmap_version(

  p_source_version_id uuid

)

returns uuid

language plpgsql

security definer

set search_path = public, pg_temp

as $$

declare

  v_source roadmap_versions%rowtype;

  v_new_version_id uuid;

  v_next_version integer;

  v_new_id uuid;

  v_module_map jsonb := '{}'::jsonb;

  v_topic_map jsonb := '{}'::jsonb;

  v_lesson_map jsonb := '{}'::jsonb;

  v_module roadmap_modules%rowtype;

  v_topic roadmap_topics%rowtype;

  v_lesson learning_lessons%rowtype;

  v_resource learning_resources%rowtype;

  v_module_resource roadmap_module_resources%rowtype;

  v_prerequisite roadmap_module_prerequisites%rowtype;

  v_topic_question topic_quiz_questions%rowtype;

  v_module_question module_quiz_questions%rowtype;

begin

  select *

  into v_source

  from roadmap_versions

  where id = p_source_version_id

    and status = 'published'

  for update;

  if not found then

    raise exception 'Only a published roadmap version can be cloned.';

  end if;

  if exists (

    select 1

    from roadmap_versions

    where track_id = v_source.track_id

      and status = 'draft'

  ) then

    raise exception 'An editable draft already exists for this track.';

  end if;

  select coalesce(max(version_number), 0) + 1

  into v_next_version

  from roadmap_versions

  where track_id = v_source.track_id;

  insert into roadmap_versions (

    track_id,

    version_number,

    status,

    change_summary

  )

  values (

    v_source.track_id,

    v_next_version,

    'draft',

    format('Draft copied from published version %s.', v_source.version_number)

  )

  returning id into v_new_version_id;

  for v_module in

    select * from roadmap_modules

    where roadmap_version_id = v_source.id

    order by sort_order

  loop

    insert into roadmap_modules (

      roadmap_version_id,

      module_key,

      sort_order,

      title,

      description,

      estimated_duration,

      skills,

      objectives,

      completion_criteria,

      topic_quiz_pass_percentage,

      module_quiz_pass_percentage,

      topic_questions_per_attempt,

      module_questions_per_attempt,

      is_active

    )

    values (

      v_new_version_id,

      v_module.module_key,

      v_module.sort_order,

      v_module.title,

      v_module.description,

      v_module.estimated_duration,

      v_module.skills,

      v_module.objectives,

      v_module.completion_criteria,

      v_module.topic_quiz_pass_percentage,

      v_module.module_quiz_pass_percentage,

      v_module.topic_questions_per_attempt,

      v_module.module_questions_per_attempt,

      v_module.is_active

    )

    returning id into v_new_id;

    v_module_map := jsonb_set(

      v_module_map,

      array[v_module.id::text],

      to_jsonb(v_new_id),

      true

    );

  end loop;

  for v_prerequisite in

    select * from roadmap_module_prerequisites

    where roadmap_version_id = v_source.id

  loop

    insert into roadmap_module_prerequisites (

      roadmap_version_id,

      roadmap_module_id,

      prerequisite_module_id

    )

    values (

      v_new_version_id,

      (v_module_map ->> v_prerequisite.roadmap_module_id::text)::uuid,

      (v_module_map ->> v_prerequisite.prerequisite_module_id::text)::uuid

    );

  end loop;

  for v_topic in

    select * from roadmap_topics

    where roadmap_version_id = v_source.id

    order by roadmap_module_id, sort_order

  loop

    insert into roadmap_topics (

      roadmap_version_id,

      roadmap_module_id,

      legacy_topic_id,

      topic_key,

      slug,

      title,

      description,

      sort_order,

      objectives,

      estimated_duration,

      pass_percentage,

      questions_per_attempt,

      is_active

    )

    values (

      v_new_version_id,

      (v_module_map ->> v_topic.roadmap_module_id::text)::uuid,

      v_topic.legacy_topic_id,

      v_topic.topic_key,

      v_topic.slug,

      v_topic.title,

      v_topic.description,

      v_topic.sort_order,

      v_topic.objectives,

      v_topic.estimated_duration,

      v_topic.pass_percentage,

      v_topic.questions_per_attempt,

      v_topic.is_active

    )

    returning id into v_new_id;

    v_topic_map := jsonb_set(

      v_topic_map,

      array[v_topic.id::text],

      to_jsonb(v_new_id),

      true

    );

  end loop;

  for v_lesson in

    select * from learning_lessons

    where roadmap_version_id = v_source.id

    order by roadmap_topic_id, sort_order

  loop

    insert into learning_lessons (

      roadmap_version_id,

      roadmap_topic_id,

      lesson_key,

      title,

      description,

      objectives,

      sort_order,

      is_required,

      is_active

    )

    values (

      v_new_version_id,

      (v_topic_map ->> v_lesson.roadmap_topic_id::text)::uuid,

      v_lesson.lesson_key,

      v_lesson.title,

      v_lesson.description,

      v_lesson.objectives,

      v_lesson.sort_order,

      v_lesson.is_required,

      v_lesson.is_active

    )

    returning id into v_new_id;

    v_lesson_map := jsonb_set(

      v_lesson_map,

      array[v_lesson.id::text],

      to_jsonb(v_new_id),

      true

    );

  end loop;

  for v_resource in

    select * from learning_resources

    where roadmap_version_id = v_source.id

    order by lesson_id, sort_order

  loop

    insert into learning_resources (

      roadmap_version_id,

      lesson_id,

      resource_key,

      title,

      resource_type,

      url,

      provider,

      description,

      language,

      duration_seconds,

      is_required,

      sort_order,

      is_active

    )

    values (

      v_new_version_id,

      (v_lesson_map ->> v_resource.lesson_id::text)::uuid,

      v_resource.resource_key,

      v_resource.title,

      v_resource.resource_type,

      v_resource.url,

      v_resource.provider,

      v_resource.description,

      v_resource.language,

      v_resource.duration_seconds,

      v_resource.is_required,

      v_resource.sort_order,

      v_resource.is_active

    );

  end loop;

  for v_module_resource in

    select * from roadmap_module_resources

    where roadmap_version_id = v_source.id

    order by roadmap_module_id, sort_order

  loop

    insert into roadmap_module_resources (

      roadmap_version_id,

      roadmap_module_id,

      resource_key,

      title,

      resource_type,

      url,

      provider,

      description,

      language,

      duration_seconds,

      is_required,

      sort_order,

      is_active

    )

    values (

      v_new_version_id,

      (v_module_map ->> v_module_resource.roadmap_module_id::text)::uuid,

      v_module_resource.resource_key,

      v_module_resource.title,

      v_module_resource.resource_type,

      v_module_resource.url,

      v_module_resource.provider,

      v_module_resource.description,

      v_module_resource.language,

      v_module_resource.duration_seconds,

      v_module_resource.is_required,

      v_module_resource.sort_order,

      v_module_resource.is_active

    );

  end loop;

  for v_topic_question in

    select * from topic_quiz_questions

    where roadmap_version_id = v_source.id

  loop

    insert into topic_quiz_questions (

      roadmap_version_id,

      roadmap_topic_id,

      question_key,

      question_version,

      prompt,

      question_type,

      difficulty,

      learning_objective,

      options,

      correct_option_id,

      explanation,

      is_active

    )

    values (

      v_new_version_id,

      (v_topic_map ->> v_topic_question.roadmap_topic_id::text)::uuid,

      v_topic_question.question_key,

      v_topic_question.question_version,

      v_topic_question.prompt,

      v_topic_question.question_type,

      v_topic_question.difficulty,

      v_topic_question.learning_objective,

      v_topic_question.options,

      v_topic_question.correct_option_id,

      v_topic_question.explanation,

      v_topic_question.is_active

    );

  end loop;

  for v_module_question in

    select * from module_quiz_questions

    where roadmap_version_id = v_source.id

  loop

    insert into module_quiz_questions (

      roadmap_version_id,

      roadmap_module_id,

      roadmap_topic_id,

      question_key,

      question_version,

      prompt,

      question_type,

      difficulty,

      learning_objective,

      options,

      correct_option_id,

      explanation,

      is_active

    )

    values (

      v_new_version_id,

      (v_module_map ->> v_module_question.roadmap_module_id::text)::uuid,

      case

        when v_module_question.roadmap_topic_id is null then null

        else (v_topic_map ->> v_module_question.roadmap_topic_id::text)::uuid

      end,

      v_module_question.question_key,

      v_module_question.question_version,

      v_module_question.prompt,

      v_module_question.question_type,

      v_module_question.difficulty,

      v_module_question.learning_objective,

      v_module_question.options,

      v_module_question.correct_option_id,

      v_module_question.explanation,

      v_module_question.is_active

    );

  end loop;

  return v_new_version_id;

end;

$$;

revoke all on function public.clone_published_roadmap_version(uuid)

from public, anon, authenticated;

grant execute on function public.clone_published_roadmap_version(uuid)

to service_role;

-- Published content stays public. Archived content is visible only to users

-- whose enrollment is pinned to that exact roadmap version. Drafts remain private.

drop policy if exists roadmap_versions_public_read

  on public.roadmap_versions;

create policy roadmap_versions_public_read

on public.roadmap_versions

for select

to anon, authenticated

using (

  status = 'published'

  or (

    status = 'archived'

    and exists (

      select 1

      from public.roadmap_enrollments e

      where e.user_id = (select auth.uid())

        and e.roadmap_version_id = roadmap_versions.id

    )

  )

);

drop policy if exists roadmap_modules_public_read

  on public.roadmap_modules;

create policy roadmap_modules_public_read

on public.roadmap_modules

for select

to anon, authenticated

using (

  is_active = true
  and exists (

    select 1

    from public.roadmap_versions rv

    where rv.id = roadmap_modules.roadmap_version_id

      and (

        rv.status = 'published'

        or (

          rv.status = 'archived'

          and exists (

            select 1

            from public.roadmap_enrollments e

            where e.user_id = (select auth.uid())

              and e.roadmap_version_id = rv.id

          )

        )

      )

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

      and (

        rv.status = 'published'

        or (

          rv.status = 'archived'

          and exists (

            select 1

            from public.roadmap_enrollments e

            where e.user_id = (select auth.uid())

              and e.roadmap_version_id = rv.id

          )

        )

      )

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

      and (

        rv.status = 'published'

        or (

          rv.status = 'archived'

          and exists (

            select 1

            from public.roadmap_enrollments e

            where e.user_id = (select auth.uid())

              and e.roadmap_version_id = rv.id

          )

        )

      )

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

      and (

        rv.status = 'published'

        or (

          rv.status = 'archived'

          and exists (

            select 1

            from public.roadmap_enrollments e

            where e.user_id = (select auth.uid())

              and e.roadmap_version_id = rv.id

          )

        )

      )

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

      and (

        rv.status = 'published'

        or (

          rv.status = 'archived'

          and exists (

            select 1

            from public.roadmap_enrollments e

            where e.user_id = (select auth.uid())

              and e.roadmap_version_id = rv.id

          )

        )

      )

  )

);

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

      and (

        rv.status = 'published'

        or (

          rv.status = 'archived'

          and exists (

            select 1

            from public.roadmap_enrollments e

            where e.user_id = (select auth.uid())

              and e.roadmap_version_id = rv.id

          )

        )

      )

  )

);

notify pgrst, 'reload schema';

commit;
