
-- =========================================================
-- MASARAK: Immutable Module Quiz Attempt Snapshots
-- Phase 2 - Quiz System
-- =========================================================

begin;

-- Each quiz attempt gets a private, immutable snapshot
-- of the exact questions and answer keys used at that time.
create table if not exists public.quiz_attempt_question_snapshots (
  id uuid primary key default gen_random_uuid(),

  attempt_id uuid not null
    references public.quiz_attempts(id) on delete cascade,

  user_id uuid not null
    references auth.users(id) on delete cascade,

  module_id text not null,
  question_id text not null,
  question_order integer not null check (question_order > 0),

  prompt_snapshot text not null,
  options_snapshot jsonb not null,
  selected_option_id text not null,
  correct_option_id text not null,
  explanation_snapshot text not null default '',

  created_at timestamptz not null default now(),

  constraint quiz_snapshot_options_array check (
    jsonb_typeof(options_snapshot) = 'array'
  ),

  constraint quiz_snapshot_selected_option_exists check (
    options_snapshot @> jsonb_build_array(
      jsonb_build_object('id', selected_option_id)
    )
  ),

  constraint quiz_snapshot_correct_option_exists check (
    options_snapshot @> jsonb_build_array(
      jsonb_build_object('id', correct_option_id)
    )
  ),

  constraint quiz_snapshot_unique_question_per_attempt
    unique (attempt_id, question_id)
);

create index if not exists quiz_question_snapshots_attempt_idx
  on public.quiz_attempt_question_snapshots (
    attempt_id,
    question_order
  );

create index if not exists quiz_question_snapshots_user_module_idx
  on public.quiz_attempt_question_snapshots (
    user_id,
    module_id
  );

-- Snapshots contain answer keys. Students must never query this table.
alter table public.quiz_attempt_question_snapshots
  enable row level security;

revoke all on table
  public.quiz_attempt_question_snapshots
from public, anon, authenticated;

grant all on table
  public.quiz_attempt_question_snapshots
to service_role;

comment on table public.quiz_attempt_question_snapshots is
  'Private immutable snapshots of module quiz questions, selected answers, correct answer keys, and explanations. Never expose directly to clients.';

-- =========================================================
-- Atomic module quiz submission
-- =========================================================

create or replace function public.submit_module_quiz_attempt(
  p_user_id uuid,
  p_module_id text,
  p_answers jsonb,
  p_question_snapshot jsonb,
  p_pass_percentage integer,
  p_prerequisite_module_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question jsonb;
  v_question_id text;
  v_selected_option_id text;
  v_correct_option_id text;

  v_seen_question_ids text[] := array[]::text[];

  v_question_count integer;
  v_answer_count integer;
  v_correct_count integer := 0;
  v_verified_prerequisite_count integer := 0;
  v_prerequisite_count integer := 0;

  v_score integer;
  v_passed boolean;
  v_attempt_id uuid;

  v_question_order integer;
begin
  -- Basic input validation.
  if p_user_id is null
     or nullif(trim(coalesce(p_module_id, '')), '') is null then
    raise exception 'Invalid quiz submission identity';
  end if;

  if p_pass_percentage is null
     or p_pass_percentage < 0
     or p_pass_percentage > 100 then
    raise exception 'Invalid quiz pass percentage';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Invalid quiz answers payload';
  end if;

  if jsonb_typeof(p_question_snapshot) is distinct from 'array' then
    raise exception 'Invalid question snapshot payload';
  end if;

  v_question_count := jsonb_array_length(p_question_snapshot);

  if v_question_count = 0 then
    raise exception 'A quiz must contain at least one question';
  end if;

  select count(*)::integer
  into v_answer_count
  from jsonb_object_keys(p_answers) as answer_keys(key);

  if v_answer_count <> v_question_count then
    raise exception 'Answer every quiz question before submitting';
  end if;

  -- Verify that every prerequisite is still completed.
  v_prerequisite_count :=
    coalesce(cardinality(p_prerequisite_module_ids), 0);

  if v_prerequisite_count > 0 then

    if v_prerequisite_count <> (
      select count(distinct prerequisite_id)::integer
      from unnest(p_prerequisite_module_ids) as item(prerequisite_id)
    ) then
      raise exception 'Invalid prerequisite list';
    end if;

    select count(distinct mp.module_id)::integer
    into v_verified_prerequisite_count
    from public.module_progress mp
    where mp.user_id = p_user_id
      and mp.module_id = any(p_prerequisite_module_ids)
      and mp.status in ('completed', 'validated');

    if v_verified_prerequisite_count <> v_prerequisite_count then
      raise exception 'One or more prerequisite modules are not completed';
    end if;
  end if;

  -- Validate every question and calculate the score on the server.
  for v_question in
    select value
    from jsonb_array_elements(p_question_snapshot)
  loop
    v_question_id := nullif(v_question ->> 'question_id', '');

    if v_question_id is null then
      raise exception 'A question is missing its ID';
    end if;

    if v_question_id = any(v_seen_question_ids) then
      raise exception 'Duplicate question ID in quiz snapshot';
    end if;

    v_seen_question_ids :=
      array_append(v_seen_question_ids, v_question_id);

    if nullif(v_question ->> 'prompt', '') is null then
      raise exception 'A question is missing its prompt';
    end if;

    if jsonb_typeof(v_question -> 'options') is distinct from 'array' then
      raise exception 'Invalid options for question %', v_question_id;
    end if;

    if jsonb_array_length(v_question -> 'options') < 2 then
      raise exception 'Question % must have at least two options', v_question_id;
    end if;

    v_selected_option_id := p_answers ->> v_question_id;
    v_correct_option_id := v_question ->> 'correct_option_id';

    if v_selected_option_id is null
       or v_correct_option_id is null then
      raise exception 'Missing answer data for question %', v_question_id;
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(v_question -> 'options') as option_item(value)
      where option_item.value ->> 'id' = v_selected_option_id
    ) then
      raise exception 'Invalid selected option for question %', v_question_id;
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(v_question -> 'options') as option_item(value)
      where option_item.value ->> 'id' = v_correct_option_id
    ) then
      raise exception 'Invalid correct option for question %', v_question_id;
    end if;

    if v_selected_option_id = v_correct_option_id then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  -- Score is calculated here, never trusted from the browser.
  v_score := round(
    (v_correct_count::numeric / v_question_count) * 100
  )::integer;

  v_passed := v_score >= p_pass_percentage;

  -- Save the attempt.
  insert into public.quiz_attempts (
    user_id,
    module_id,
    answers,
    score,
    passed
  )
  values (
    p_user_id,
    p_module_id,
    p_answers,
    v_score,
    v_passed
  )
  returning id into v_attempt_id;

  -- Save the exact questions and answer keys used in this attempt.
  for v_question, v_question_order in
    select entry.value, entry.ordinality::integer
    from jsonb_array_elements(p_question_snapshot)
      with ordinality as entry(value, ordinality)
  loop
    insert into public.quiz_attempt_question_snapshots (
      attempt_id,
      user_id,
      module_id,
      question_id,
      question_order,
      prompt_snapshot,
      options_snapshot,
      selected_option_id,
      correct_option_id,
      explanation_snapshot
    )
    values (
      v_attempt_id,
      p_user_id,
      p_module_id,
      v_question ->> 'question_id',
      v_question_order,
      v_question ->> 'prompt',
      v_question -> 'options',
      p_answers ->> (v_question ->> 'question_id'),
      v_question ->> 'correct_option_id',
      coalesce(v_question ->> 'explanation', '')
    );
  end loop;

  -- Update module progress only when the quiz is passed.
  if v_passed then
    insert into public.module_progress (
      user_id,
      module_id,
      status,
      verification_source,
      score,
      verified_at
    )
    values (
      p_user_id,
      p_module_id,
      'completed',
      'module_quiz',
      v_score,
      now()
    )
    on conflict (user_id, module_id)
    do update set
      status = excluded.status,
      verification_source = excluded.verification_source,
      score = excluded.score,
      verified_at = excluded.verified_at,
      updated_at = now();
  end if;

  -- Return only the attempt summary.
  -- Answer keys stay in the private snapshot table.
  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'correct_count', v_correct_count,
    'total_questions', v_question_count,
    'passed', v_passed
  );
end;
$$;

-- Only trusted server-side code using the service role can call this RPC.
revoke all on function public.submit_module_quiz_attempt(
  uuid,
  text,
  jsonb,
  jsonb,
  integer,
  text[]
) from public, anon, authenticated;

grant execute on function public.submit_module_quiz_attempt(
  uuid,
  text,
  jsonb,
  jsonb,
  integer,
  text[]
) to service_role;

commit;
