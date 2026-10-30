-- Masarak topic-level placement assessment (additive migration)
-- Run once in Supabase SQL Editor. Existing module quizzes are not removed.

alter table public.profiles
  add column if not exists role text not null default 'student',
  add column if not exists latest_topic_assessment_id uuid;

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'admin'));

-- Keep role and report pointers server-controlled; preserve the existing
-- profile fields that students are allowed to update.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, selected_start_path) on public.profiles to authenticated;

create table if not exists public.learning_topics (
  id uuid primary key default gen_random_uuid(),
  module_id text not null,
  slug text not null,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug)
);

create index if not exists learning_topics_module_sort_idx
  on public.learning_topics (module_id, sort_order, title);

create table if not exists public.topic_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.learning_topics(id) on delete cascade,
  prompt text not null,
  question_type text not null default 'knowledge'
    check (question_type in ('knowledge', 'scenario')),
  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),
  options jsonb not null,
  correct_option_id text not null,
  explanation text not null default '',
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topic_question_options_array check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2
  ),
  constraint topic_question_correct_option_exists check (
    options @> jsonb_build_array(jsonb_build_object('id', correct_option_id))
  )
);

create index if not exists topic_questions_active_idx
  on public.topic_assessment_questions (topic_id, is_active, difficulty);

create table if not exists public.topic_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'failed')),
  selections jsonb not null default '[]'::jsonb,
  -- Contains answer keys. Never grant direct client access to this table.
  question_snapshot jsonb not null default '[]'::jsonb,
  report jsonb,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  score integer check (score between 0 and 100),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint topic_attempt_selections_array check (jsonb_typeof(selections) = 'array'),
  constraint topic_attempt_snapshot_array check (jsonb_typeof(question_snapshot) = 'array')
);

create index if not exists topic_attempts_user_created_idx
  on public.topic_assessment_attempts (user_id, created_at desc);

create table if not exists public.topic_assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.topic_assessment_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.learning_topics(id),
  question_id uuid not null,
  question_version integer not null,
  prompt_snapshot text not null,
  options_snapshot jsonb not null,
  selected_option_id text not null,
  correct_option_id text not null,
  explanation_snapshot text not null default '',
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists topic_answers_attempt_idx
  on public.topic_assessment_answers (attempt_id, topic_id);

create table if not exists public.student_topic_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.learning_topics(id) on delete cascade,
  self_assessment text not null
    check (self_assessment in ('know', 'unknown', 'unsure')),
  result_status text not null
    check (result_status in (
      'self_reported_unknown', 'screening_passed', 'needs_review', 'needs_learning'
    )),
  score integer check (score between 0 and 100),
  best_score integer check (best_score between 0 and 100),
  correct_count integer not null default 0,
  question_count integer not null default 0,
  confidence text check (confidence in ('low', 'medium')),
  latest_attempt_id uuid references public.topic_assessment_attempts(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index if not exists student_topic_mastery_user_idx
  on public.student_topic_mastery (user_id, updated_at desc);

alter table public.profiles
  drop constraint if exists profiles_latest_topic_assessment_fk;
alter table public.profiles
  add constraint profiles_latest_topic_assessment_fk
  foreign key (latest_topic_assessment_id)
  references public.topic_assessment_attempts(id)
  on delete set null;

-- Public users can see the names/descriptions of active topics, never question keys.
alter table public.learning_topics enable row level security;
alter table public.topic_assessment_questions enable row level security;
alter table public.topic_assessment_attempts enable row level security;
alter table public.topic_assessment_answers enable row level security;
alter table public.student_topic_mastery enable row level security;

revoke all on table public.learning_topics from PUBLIC, anon, authenticated;
revoke all on table public.topic_assessment_questions from PUBLIC, anon, authenticated;
revoke all on table public.topic_assessment_attempts from PUBLIC, anon, authenticated;
revoke all on table public.topic_assessment_answers from PUBLIC, anon, authenticated;
revoke all on table public.student_topic_mastery from PUBLIC, anon, authenticated;

grant select on public.learning_topics to anon, authenticated;
grant all on public.learning_topics to service_role;
grant all on public.topic_assessment_questions to service_role;
grant all on public.topic_assessment_attempts to service_role;
grant all on public.topic_assessment_answers to service_role;
grant all on public.student_topic_mastery to service_role;

drop policy if exists "active_topics_are_public" on public.learning_topics;
create policy "active_topics_are_public"
  on public.learning_topics for select to anon, authenticated
  using (is_active = true);

-- No client-side policies or grants are created for question keys, attempts,
-- snapshots, answers, or mastery. Server actions / the RPC mediate access.

create or replace function public.complete_topic_assessment(
  p_attempt_id uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.topic_assessment_attempts%rowtype;
  v_question jsonb;
  v_selection jsonb;
  v_answer text;
  v_correct text;
  v_correct_count integer := 0;
  v_question_count integer := 0;
  v_answer_count integer := 0;
  v_topic_correct integer;
  v_topic_questions integer;
  v_topic_score integer;
  v_topic_status text;
  v_confidence text;
  v_topic_id uuid;
  v_topic_title text;
  v_module_id text;
  v_questions_report jsonb := '[]'::jsonb;
  v_topics_report jsonb := '[]'::jsonb;
  v_selected_label text;
  v_correct_label text;
  v_report jsonb;
  v_score integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Invalid answers payload';
  end if;

  select * into v_attempt
  from public.topic_assessment_attempts
  where id = p_attempt_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Assessment attempt not found';
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'This assessment attempt is no longer active';
  end if;

  v_question_count := jsonb_array_length(v_attempt.question_snapshot);

  select count(*) into v_answer_count from jsonb_object_keys(p_answers);

  if v_answer_count <> v_question_count then
    raise exception 'Answer every displayed question before submitting';
  end if;

  -- Validate and record answers using the immutable snapshot created at start.
  for v_question in
    select value from jsonb_array_elements(v_attempt.question_snapshot)
  loop
    v_answer := p_answers ->> (v_question ->> 'id');
    v_correct := v_question ->> 'correct_option_id';

    if v_answer is null or not exists (
      select 1
      from jsonb_array_elements(v_question -> 'options') as opt(value)
      where opt.value ->> 'id' = v_answer
    ) then
      raise exception 'Invalid or missing answer';
    end if;

    select opt.value ->> 'label' into v_selected_label
    from jsonb_array_elements(v_question -> 'options') as opt(value)
    where opt.value ->> 'id' = v_answer;

    select opt.value ->> 'label' into v_correct_label
    from jsonb_array_elements(v_question -> 'options') as opt(value)
    where opt.value ->> 'id' = v_correct;

    insert into public.topic_assessment_answers (
      attempt_id, user_id, topic_id, question_id, question_version,
      prompt_snapshot, options_snapshot, selected_option_id,
      correct_option_id, explanation_snapshot, is_correct
    ) values (
      p_attempt_id, v_user_id, (v_question ->> 'topic_id')::uuid,
      (v_question ->> 'id')::uuid, coalesce((v_question ->> 'version')::integer, 1),
      v_question ->> 'prompt', v_question -> 'options', v_answer,
      v_correct, coalesce(v_question ->> 'explanation', ''), v_answer = v_correct
    );

    if v_answer = v_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_questions_report := v_questions_report || jsonb_build_array(
      jsonb_build_object(
        'questionId', v_question ->> 'id',
        'topicId', v_question ->> 'topic_id',
        'prompt', v_question ->> 'prompt',
        'selectedAnswer', v_selected_label,
        'correctAnswer', v_correct_label,
        'isCorrect', v_answer = v_correct,
        'explanation', coalesce(v_question ->> 'explanation', '')
      )
    );
  end loop;

  -- Calculate a separate result for every self-selected topic.
  for v_selection in
    select value from jsonb_array_elements(v_attempt.selections)
  loop
    v_topic_id := (v_selection ->> 'topic_id')::uuid;
    select t.title, t.module_id into v_topic_title, v_module_id
    from public.learning_topics t where t.id = v_topic_id;


    if v_selection ->> 'self_assessment' = 'unknown' then
      v_topic_correct := 0;
      v_topic_questions := 0;
      v_topic_score := null;
      v_topic_status := 'self_reported_unknown';
      v_confidence := null;
    else
      select count(*), count(*) filter (where a.is_correct)
      into v_topic_questions, v_topic_correct
      from public.topic_assessment_answers a
      where a.attempt_id = p_attempt_id and a.topic_id = v_topic_id;

      if v_topic_questions = 0 then
        raise exception 'No questions were assigned to a selected topic';
      end if;

      v_topic_score := round((v_topic_correct::numeric / v_topic_questions) * 100);

      if v_topic_correct = v_topic_questions then
        v_topic_status := 'screening_passed';
        v_confidence := 'medium';
      elsif v_topic_correct = 0 then
        v_topic_status := 'needs_learning';
        v_confidence := 'low';
      else
        v_topic_status := 'needs_review';
        v_confidence := 'low';
      end if;
    end if;

    insert into public.student_topic_mastery as existing (
      user_id, topic_id, self_assessment, result_status, score, best_score,
      correct_count, question_count, confidence, latest_attempt_id, updated_at
    ) values (
      v_user_id, v_topic_id, v_selection ->> 'self_assessment', v_topic_status,
      v_topic_score, v_topic_score, v_topic_correct, v_topic_questions,
      v_confidence, p_attempt_id, now()
    )
    on conflict (user_id, topic_id) do update set
      self_assessment = excluded.self_assessment,
      result_status = case
        when existing.best_score is not null
          and (excluded.score is null or excluded.score < existing.best_score)
          then existing.result_status
        else excluded.result_status
      end,
      score = excluded.score,
      best_score = case
        when excluded.score is null then existing.best_score
        when existing.best_score is null then excluded.score
        else greatest(existing.best_score, excluded.score)
      end,
      correct_count = excluded.correct_count,
      question_count = excluded.question_count,
      confidence = case
        when existing.best_score is not null
          and (excluded.score is null or excluded.score < existing.best_score)
          then existing.confidence
        else excluded.confidence
      end,
      latest_attempt_id = excluded.latest_attempt_id,
      updated_at = now();

    v_topics_report := v_topics_report || jsonb_build_array(
      jsonb_build_object(
        'topicId', v_topic_id,
        'topicTitle', v_topic_title,
        'moduleId', v_module_id,
        'moduleTitle', v_module_id,
        'selfAssessment', v_selection ->> 'self_assessment',
        'status', v_topic_status,
        'score', v_topic_score,
        'correctCount', v_topic_correct,
        'questionCount', v_topic_questions,
        'confidence', v_confidence
      )
    );
  end loop;

  if v_question_count > 0 then
    v_score := round((v_correct_count::numeric / v_question_count) * 100);
  else
    v_score := null;
  end if;

  v_report := jsonb_build_object(
    'attemptId', p_attempt_id,
    'score', v_score,
    'correctCount', v_correct_count,
    'questionCount', v_question_count,
    'topics', v_topics_report,
    'questions', v_questions_report,
    'completedAt', now()
  );

  update public.topic_assessment_attempts
  set status = 'completed',
      total_questions = v_question_count,
      correct_answers = v_correct_count,
      score = v_score,
      report = v_report,
      completed_at = now()
  where id = p_attempt_id and user_id = v_user_id;

  insert into public.profiles (id, selected_start_path, latest_topic_assessment_id)
  values (v_user_id, 'placement', p_attempt_id)
  on conflict (id) do update set
    selected_start_path = 'placement',
    latest_topic_assessment_id = excluded.latest_topic_assessment_id,
    updated_at = now();

  return v_report;
end;
$$;

revoke all on function public.complete_topic_assessment(uuid, jsonb) from PUBLIC, anon;
grant execute on function public.complete_topic_assessment(uuid, jsonb) to authenticated;

-- Seed provisional topics and two starter questions per topic.
-- These are starter content only; manage and expand them from /admin.
do $$
declare
  r record;
  q jsonb;
  v_topic_id uuid;
begin
  for r in
    select * from (values
      ('web-fundamentals','browser-request','Browser request lifecycle','What happens between entering a URL and seeing a page?',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What normally happens after you enter a website URL in a browser?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','The browser requests resources from a server'),jsonb_build_object('id','b','label','The browser edits the server database'),jsonb_build_object('id','c','label','The browser creates a new domain')),'correct','a','explanation','The browser resolves the destination and sends requests for the required resources.'),
          jsonb_build_object('prompt','Which component is primarily responsible for rendering HTML and CSS into a visible page?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','The browser rendering engine'),jsonb_build_object('id','b','label','The DNS server'),jsonb_build_object('id','c','label','The database index')),'correct','a','explanation','The browser rendering engine parses and renders the page.' )
        )),
      ('web-fundamentals','http-basics','HTTP fundamentals','Requests, responses, methods, and status codes.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','Which HTTP method is normally used to retrieve a resource without changing it?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','GET'),jsonb_build_object('id','b','label','DELETE'),jsonb_build_object('id','c','label','PATCH')),'correct','a','explanation','GET requests a representation of a resource.'),
          jsonb_build_object('prompt','What does an HTTP 404 response indicate?','type','scenario','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','The requested resource was not found'),jsonb_build_object('id','b','label','The user is authenticated'),jsonb_build_object('id','c','label','The server created the resource')),'correct','a','explanation','404 indicates that the requested resource could not be found.' )
        )),
      ('html-css','semantic-html','Semantic HTML','Meaningful page structure and accessible markup.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','Why use elements such as main, nav, and article?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','They describe the meaning and structure of content'),jsonb_build_object('id','b','label','They replace JavaScript'),jsonb_build_object('id','c','label','They automatically style every page')),'correct','a','explanation','Semantic elements communicate structure to browsers and assistive technology.'),
          jsonb_build_object('prompt','What is the most useful alt text for an informative image?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','A concise description of the information the image conveys'),jsonb_build_object('id','b','label','The image file size'),jsonb_build_object('id','c','label','The word image for every picture')),'correct','a','explanation','Alt text should communicate the purpose or information of an informative image.' )
        )),
      ('html-css','html-forms','HTML forms','Labels, inputs, validation attributes, and submission.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','How should a label be associated with an input?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','The label for value matches the input id'),jsonb_build_object('id','b','label','The label text is placed only in a placeholder'),jsonb_build_object('id','c','label','The input must be hidden')),'correct','a','explanation','Matching label for and input id gives the control an accessible name.'),
          jsonb_build_object('prompt','Which attribute makes a field required by the browser before form submission?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','required'),jsonb_build_object('id','b','label','readonly'),jsonb_build_object('id','c','label','autofocus')),'correct','a','explanation','The required attribute triggers built-in constraint validation.' )
        )),
      ('html-css','css-positioning','CSS positioning','Static, relative, absolute, fixed, and sticky positioning.',3,
        jsonb_build_array(
          jsonb_build_object('prompt','What is the usual reference area for position: fixed?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','The viewport'),jsonb_build_object('id','b','label','The next sibling element'),jsonb_build_object('id','c','label','The text baseline')),'correct','a','explanation','A fixed element is positioned relative to the viewport in the common case.'),
          jsonb_build_object('prompt','A header should stay near the top while scrolling, but remain in normal flow until it reaches that point. Which position is most suitable?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','sticky'),jsonb_build_object('id','b','label','absolute'),jsonb_build_object('id','c','label','static only')),'correct','a','explanation','Sticky positioning behaves normally until its scroll threshold is reached.' )
        )),
      ('html-css','css-layout','CSS layout: Flexbox and Grid','One-dimensional and two-dimensional layout.',4,
        jsonb_build_array(
          jsonb_build_object('prompt','Flexbox is primarily designed for which kind of layout?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','One-dimensional row or column layout'),jsonb_build_object('id','b','label','Database relationships'),jsonb_build_object('id','c','label','HTTP routing')),'correct','a','explanation','Flexbox aligns items along one main axis.'),
          jsonb_build_object('prompt','You need to control rows and columns together in a page layout. Which CSS tool is usually the better fit?','type','scenario','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','CSS Grid'),jsonb_build_object('id','b','label','localStorage'),jsonb_build_object('id','c','label','z-index only')),'correct','a','explanation','Grid is designed for two-dimensional row and column layouts.' )
        )),
      ('html-css','responsive-design','Responsive design','Media queries, fluid sizing, and mobile layouts.',5,
        jsonb_build_array(
          jsonb_build_object('prompt','What is the main purpose of a CSS media query?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Apply styles when specified device or viewport conditions match'),jsonb_build_object('id','b','label','Send an HTTP request'),jsonb_build_object('id','c','label','Create a database table')),'correct','a','explanation','Media queries conditionally apply CSS based on media features.'),
          jsonb_build_object('prompt','A layout overflows on narrow screens because widths are fixed at 900px. What is a sensible first improvement?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Use fluid sizing and responsive breakpoints'),jsonb_build_object('id','b','label','Use a larger fixed width'),jsonb_build_object('id','c','label','Disable the viewport meta tag')),'correct','a','explanation','Fluid dimensions and responsive breakpoints help layouts adapt to available space.' )
        )),
      ('javascript','js-fundamentals','JavaScript fundamentals','Variables, values, types, and equality.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What is the main difference between === and == in JavaScript?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Strict equality does not perform implicit type coercion'),jsonb_build_object('id','b','label','Strict equality always converts values to strings'),jsonb_build_object('id','c','label','There is no difference')),'correct','a','explanation','Strict equality compares without the coercion performed by loose equality.'),
          jsonb_build_object('prompt','Which declaration prevents reassignment of the variable binding?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','const'),jsonb_build_object('id','b','label','let'),jsonb_build_object('id','c','label','var')),'correct','a','explanation','A const binding cannot be reassigned, though referenced objects may still be mutable.' )
        )),
      ('javascript','js-functions-arrays','Functions and arrays','Functions, iteration, and common array methods.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','What does Array.prototype.map() return?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','A new array containing the callback results'),jsonb_build_object('id','b','label','Always the first element'),jsonb_build_object('id','c','label','A boolean only')),'correct','a','explanation','map creates a new array from the callback result for each element.'),
          jsonb_build_object('prompt','You want only users whose age is at least 18. Which array method is most appropriate?','type','scenario','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','filter'),jsonb_build_object('id','b','label','map'),jsonb_build_object('id','c','label','join')),'correct','a','explanation','filter returns the elements that satisfy the predicate.' )
        )),
      ('javascript','js-async','Promises and async JavaScript','Promises, async/await, and error handling.',3,
        jsonb_build_array(
          jsonb_build_object('prompt','What does await do inside an async function?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Waits for a Promise to settle before continuing that function'),jsonb_build_object('id','b','label','Blocks the entire server forever'),jsonb_build_object('id','c','label','Converts every value to a string')),'correct','a','explanation','await pauses the async function until the Promise settles.'),
          jsonb_build_object('prompt','Where should a rejected Promise be handled in a try/catch flow?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Await it inside the try block and handle the rejection in catch'),jsonb_build_object('id','b','label','Ignore the rejection'),jsonb_build_object('id','c','label','Put catch before try')),'correct','a','explanation','A rejected Promise awaited in the try block transfers control to catch.' )
        )),
      ('git-github','git-commits','Git commits','Working tree, staging, commits, and history.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What does a Git commit represent?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','A recorded snapshot of staged repository changes'),jsonb_build_object('id','b','label','A production deployment'),jsonb_build_object('id','c','label','A GitHub user account')),'correct','a','explanation','A commit records a repository snapshot and metadata.'),
          jsonb_build_object('prompt','Which command shows changed files and what is staged?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','git status'),jsonb_build_object('id','b','label','git init only'),jsonb_build_object('id','c','label','git remote -v')),'correct','a','explanation','git status summarizes the working tree and staging area.' )
        )),
      ('git-github','git-branches','Branches and collaboration','Branches, merge, pull, and remote repositories.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','Why create a Git branch?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','To work on an isolated line of development'),jsonb_build_object('id','b','label','To remove the need for commits'),jsonb_build_object('id','c','label','To encrypt the repository')),'correct','a','explanation','Branches let work progress independently before integration.'),
          jsonb_build_object('prompt','What does git pull normally do?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Fetches remote changes and integrates them into the current branch'),jsonb_build_object('id','b','label','Deletes the remote repository'),jsonb_build_object('id','c','label','Creates a new GitHub account')),'correct','a','explanation','git pull fetches and integrates updates from the configured remote.' )
        )),
      ('react','react-components-props','Components and props','Reusable components, props, and rendering lists.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What are React props primarily used for?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Passing data from a parent component to a child'),jsonb_build_object('id','b','label','Writing SQL queries'),jsonb_build_object('id','c','label','Creating CSS media queries')),'correct','a','explanation','Props are inputs passed to a component by its parent.'),
          jsonb_build_object('prompt','Why should list items rendered with map have stable keys?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Help React identify items between renders'),jsonb_build_object('id','b','label','Encrypt each item'),jsonb_build_object('id','c','label','Prevent every rerender')),'correct','a','explanation','Keys help React match list elements as items change.' )
        )),
      ('react','react-state-hooks','State and Hooks','useState, useEffect, and component state.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','Which Hook is commonly used for local component state?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','useState'),jsonb_build_object('id','b','label','useDatabase'),jsonb_build_object('id','c','label','useServerFile')),'correct','a','explanation','useState returns a state value and a setter.'),
          jsonb_build_object('prompt','When is useEffect generally appropriate?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Synchronizing with an external system such as a subscription'),jsonb_build_object('id','b','label','Computing every value that can be calculated during render'),jsonb_build_object('id','c','label','Replacing all event handlers')),'correct','a','explanation','Effects are intended for synchronization with external systems.' )
        )),
      ('node-express','express-routing','Express routing','HTTP routes, handlers, and request/response flow.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What is Express routing used for?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Connecting HTTP methods and paths to handlers'),jsonb_build_object('id','b','label','Styling page elements'),jsonb_build_object('id','c','label','Creating Git branches')),'correct','a','explanation','Routes define how the application responds to a method and path.'),
          jsonb_build_object('prompt','Which Express method defines a handler for GET /users?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','app.get'),jsonb_build_object('id','b','label','app.css'),jsonb_build_object('id','c','label','app.select')),'correct','a','explanation','app.get registers a handler for GET requests to a path.' )
        )),
      ('node-express','express-middleware','Middleware and errors','Middleware order, next, validation, and error handling.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','What is middleware commonly used for in Express?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Logging, validation, authentication, and request processing'),jsonb_build_object('id','b','label','Only changing screen brightness'),jsonb_build_object('id','c','label','Replacing JavaScript with SQL')),'correct','a','explanation','Middleware can inspect or process a request before the final route handler.'),
          jsonb_build_object('prompt','What does next() normally do in ordinary Express middleware?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Passes control to the next middleware or handler'),jsonb_build_object('id','b','label','Restarts the computer'),jsonb_build_object('id','c','label','Deletes the request')),'correct','a','explanation','Calling next passes control through the middleware chain.' )
        )),
      ('databases-sql','relational-model','Relational data modeling','Tables, primary keys, foreign keys, and relationships.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What is the purpose of a primary key?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Uniquely identify each row in a table'),jsonb_build_object('id','b','label','Style the table'),jsonb_build_object('id','c','label','Make every value optional')),'correct','a','explanation','A primary key uniquely identifies each row.'),
          jsonb_build_object('prompt','What does a foreign key represent?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','A reference to a key in another or the same table'),jsonb_build_object('id','b','label','A CSS selector'),jsonb_build_object('id','c','label','A database password')),'correct','a','explanation','A foreign key enforces a relationship to a referenced key.' )
        )),
      ('databases-sql','sql-queries','SQL querying','Filtering, sorting, joins, and aggregation.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','Which SQL clause filters rows before grouping?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','WHERE'),jsonb_build_object('id','b','label','ORDER BY'),jsonb_build_object('id','c','label','CREATE DATABASE')),'correct','a','explanation','WHERE filters rows that meet a condition.'),
          jsonb_build_object('prompt','Which SQL operation combines related rows from two tables?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','JOIN'),jsonb_build_object('id','b','label','DROP'),jsonb_build_object('id','c','label','TRUNCATE')),'correct','a','explanation','JOIN combines rows based on a related condition.' )
        )),
      ('auth-security','authentication-authorization','Authentication and authorization','Identity, sessions, and permission checks.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What is the difference between authentication and authorization?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Authentication verifies identity; authorization checks permissions'),jsonb_build_object('id','b','label','They are always identical'),jsonb_build_object('id','c','label','Authorization styles the page')),'correct','a','explanation','Authentication answers who the user is; authorization answers what they can do.'),
          jsonb_build_object('prompt','A signed-in student tries to open an admin page. What must the server check?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Whether the user has the required admin permission'),jsonb_build_object('id','b','label','Only whether a cookie exists'),jsonb_build_object('id','c','label','The browser window size')),'correct','a','explanation','A valid session alone does not grant admin authorization.' )
        )),
      ('auth-security','data-access-security','Data access security','RLS, server-side authorization, and safe data access.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','What does Row Level Security help control?','type','knowledge','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','Which rows a database user can read or modify'),jsonb_build_object('id','b','label','Which font a browser uses'),jsonb_build_object('id','c','label','How Git branches are named')),'correct','a','explanation','RLS policies restrict rows based on the current database role and user context.'),
          jsonb_build_object('prompt','Where should a privileged service secret be used?','type','scenario','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Only in trusted server-side code'),jsonb_build_object('id','b','label','In a NEXT_PUBLIC browser variable'),jsonb_build_object('id','c','label','Inside a public README')),'correct','a','explanation','Privileged secrets must never be exposed to client-side code.' )
        )),
      ('testing-deployment','unit-testing','Testing fundamentals','Assertions, isolated behavior, and regression checks.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What does a unit test usually focus on?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','A small isolated unit of behavior'),jsonb_build_object('id','b','label','The entire internet'),jsonb_build_object('id','c','label','Only the production server location')),'correct','a','explanation','Unit tests check a small unit of behavior in isolation.'),
          jsonb_build_object('prompt','What is an assertion used for in a test?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','Checking that an actual result matches an expectation'),jsonb_build_object('id','b','label','Deploying a database'),jsonb_build_object('id','c','label','Creating a CSS layout')),'correct','a','explanation','Assertions express expected outcomes that the test verifies.' )
        )),
      ('testing-deployment','deployment-environment','Deployment and environment','Production configuration, environment variables, and releases.',2,
        jsonb_build_array(
          jsonb_build_object('prompt','Where should a production secret API key be stored?','type','knowledge','difficulty','easy','options',jsonb_build_array(jsonb_build_object('id','a','label','A server-side environment variable or secrets manager'),jsonb_build_object('id','b','label','Public client-side source code'),jsonb_build_object('id','c','label','The page title')),'correct','a','explanation','Production secrets must remain server-side and out of source control.'),
          jsonb_build_object('prompt','Why should a deployment be checked after changing an environment variable?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','The deployment needs the updated environment to run with the new value'),jsonb_build_object('id','b','label','Environment variables automatically rewrite old builds'),jsonb_build_object('id','c','label','The database deletes all user records')),'correct','a','explanation','A new deployment ensures the application build/runtime receives the updated configuration.' )
        )),
      ('final-project','fullstack-integration','Full-stack integration','Connecting UI, APIs, persistence, and deployment.',1,
        jsonb_build_array(
          jsonb_build_object('prompt','What is a sensible responsibility split in a full-stack application?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','The UI handles presentation while trusted server code enforces rules and accesses secrets'),jsonb_build_object('id','b','label','The browser stores all privileged secrets'),jsonb_build_object('id','c','label','The database renders the entire user interface')),'correct','a','explanation','Presentation belongs in the client, while authorization and secrets must be enforced server-side.'),
          jsonb_build_object('prompt','What should happen when a UI action saves data?','type','scenario','difficulty','medium','options',jsonb_build_array(jsonb_build_object('id','a','label','The server validates the request, persists it, and returns a truthful result'),jsonb_build_object('id','b','label','The UI should show success before sending the request'),jsonb_build_object('id','c','label','The client should bypass authorization')),'correct','a','explanation','The UI should reflect the confirmed server result, including validation and failures.' )
        ))
    ) as seed(module_id, slug, title, description, sort_order, questions)
  loop
    insert into public.learning_topics (module_id, slug, title, description, sort_order, is_active)
    values (r.module_id, r.slug, r.title, r.description, r.sort_order, true)
    on conflict (module_id, slug) do update set
      title = excluded.title,
      description = excluded.description,
      sort_order = excluded.sort_order;

    select id into v_topic_id from public.learning_topics
    where module_id = r.module_id and slug = r.slug;

    -- Do not duplicate starter questions when this migration is re-run.
    if not exists (
      select 1 from public.topic_assessment_questions q
      where q.topic_id = v_topic_id
    ) then
      for q in select value from jsonb_array_elements(r.questions)
      loop
        insert into public.topic_assessment_questions (
          topic_id, prompt, question_type, difficulty, options,
          correct_option_id, explanation, version, is_active
        ) values (
          v_topic_id,
          q ->> 'prompt',
          q ->> 'type',
          q ->> 'difficulty',
          q -> 'options',
          q ->> 'correct',
          q ->> 'explanation',
          1,
          true
        );
      end loop;
    end if;
  end loop;
end;
$$;

-- After running this migration, promote your own account to admin in SQL Editor:
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('YOUR_LOGIN_EMAIL'));
