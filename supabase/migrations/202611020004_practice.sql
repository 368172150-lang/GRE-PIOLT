-- Phase 4: deterministic practice, sessions, feedback snapshots and deduplicated mistakes.
begin;
alter table public.question_options add column blank_index integer check(blank_index between 0 and 2);
create table public.question_solutions(question_id uuid primary key references public.questions(id) on delete cascade,solution jsonb not null);
alter table public.question_solutions enable row level security;
revoke all on public.question_solutions from public,anon,authenticated;
create table public.question_bookmarks(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,question_id uuid not null references public.questions(id),unique(user_id,question_id));
alter table public.question_bookmarks enable row level security;
revoke all on public.question_bookmarks from public,anon,authenticated;
grant select on public.question_bookmarks to authenticated;
create policy owner_read on public.question_bookmarks for select to authenticated using((select auth.uid())=user_id);

alter table public.practice_sessions add column local_date date;
alter table public.practice_sessions add column timezone text;
alter table public.practice_sessions add column question_ids jsonb not null default '[]';
alter table public.practice_sessions add column deadline_at timestamptz;
alter table public.practice_sessions add column current_started_at timestamptz not null default now();
alter table public.practice_sessions add column start_input jsonb;
alter table public.practice_attempts add column local_date date;
alter table public.practice_attempts add column elapsed_seconds integer not null default 0 check(elapsed_seconds between 0 and 86400);
alter table public.practice_attempts add column question_revision integer not null default 1;
alter table public.practice_attempts add column question_snapshot jsonb;
alter table public.practice_attempts add column feedback jsonb;
alter table public.practice_attempts add column request_input jsonb;
create unique index graded_session_question on public.practice_attempts(session_id,question_id) where request_input is not null;
create index attempts_daily_module on public.practice_attempts(user_id,local_date,question_id);
alter table public.mistake_records add column first_attempt_id uuid references public.practice_attempts(id);
alter table public.mistake_records add column last_attempt_id uuid references public.practice_attempts(id);
alter table public.mistake_records add column last_wrong_answer jsonb;
alter table public.mistake_records add column reviewed_on date;
alter table public.mistake_records add column revision integer not null default 0 check(revision>=0);
update public.mistake_records set last_wrong_answer=wrong_answer;

create function public.practice_question(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select q.content||jsonb_build_object('id',q.id,'module',q.module,'type',q.question_type,'difficulty',q.difficulty,'prompt',q.prompt,'source',q.source,'review_status',q.review_status,'options',coalesce((select jsonb_agg(jsonb_build_object('key',o.option_key,'text',o.content,'blank_index',o.blank_index) order by o.option_key) from public.question_options o where o.question_id=q.id),'[]')) from public.questions q where q.id=p_id and q.review_status='reviewed' and exists(select 1 from public.question_solutions s where s.question_id=q.id)
$$;
create function public.practice_number(p_text text) returns numeric[] language plpgsql immutable set search_path='' as $$
declare value text;parts text[];a numeric;b numeric=1;
begin
 if p_text is null or length(p_text)>80 then raise exception 'INVALID_NUMBER';end if;
 value=btrim(p_text,E' \t\n\r\f'||chr(11));
 if value !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)(/[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+))?$' then raise exception 'INVALID_NUMBER';end if;
 parts=string_to_array(value,'/');a=parts[1]::numeric;if array_length(parts,1)=2 then b=parts[2]::numeric;end if;
 if b=0 then raise exception 'INVALID_NUMBER';end if;return array[a,b];
end;$$;
create function public.practice_grade(p_question jsonb,p_solution jsonb,p_answer jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare kind text=p_question->>'format';chosen jsonb;expected jsonb;item jsonb;idx integer=0;number_a numeric[];number_b numeric[];count_keys integer;
begin
 if p_answer is null or jsonb_typeof(p_answer)<>'object' then raise exception 'ANSWER_FORMAT';end if;
 select count(*) into count_keys from jsonb_object_keys(p_answer);if count_keys<>1 then raise exception 'ANSWER_FORMAT';end if;
 if kind='numeric' then
  if jsonb_typeof(p_answer->'numeric') is distinct from 'string' then raise exception 'ANSWER_FORMAT';end if;
  number_a=public.practice_number(p_answer->>'numeric');number_b=public.practice_number(p_solution#>>'{answer,numeric}');return number_a[1]*number_b[2]=number_b[1]*number_a[2];
 elsif kind='blanks' then
  chosen=p_answer->'blanks';if jsonb_typeof(chosen) is distinct from 'array' then raise exception 'ANSWER_FORMAT';end if;
  if jsonb_array_length(chosen)<>(p_question->>'blank_count')::integer then raise exception 'ANSWER_INCOMPLETE';end if;
  for item in select value from jsonb_array_elements(chosen) loop
   if jsonb_typeof(item) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(p_question->'options') o where o->>'key'=item#>>'{}' and (o->>'blank_index')::integer=idx) then raise exception 'ANSWER_OPTION';end if;idx=idx+1;
  end loop;return chosen=p_solution#>'{answer,blanks}';
 else
  chosen=p_answer->'choices';if jsonb_typeof(chosen) is distinct from 'array' then raise exception 'ANSWER_FORMAT';end if;
  if jsonb_array_length(chosen)<>(p_question->>'selection_count')::integer then raise exception 'ANSWER_INCOMPLETE';end if;
  if (select count(distinct value) from jsonb_array_elements(chosen))<>jsonb_array_length(chosen) then raise exception 'ANSWER_OPTION';end if;
  for item in select value from jsonb_array_elements(chosen) loop
   if jsonb_typeof(item) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(p_question->'options') o where o->>'key'=item#>>'{}') then raise exception 'ANSWER_OPTION';end if;
  end loop;
  select jsonb_agg(value order by value) into chosen from jsonb_array_elements(chosen);
  select jsonb_agg(value order by value) into expected from jsonb_array_elements(p_solution#>'{answer,choices}');return chosen=expected;
 end if;
end;$$;
create or replace function public.study_signals(p_user uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare result jsonb;mod_name text;attempts integer;correct integer;weak text;tz text;
begin
 select timezone into tz from public.user_settings where user_id=p_user;tz=coalesce(tz,'Asia/Kuala_Lumpur');
 result=jsonb_build_object(
 'dueReviews',(select count(*) from public.vocabulary_progress p join public.vocabulary v on v.id=p.vocabulary_id where p.user_id=p_user and p.status<>'new' and v.review_status='reviewed' and (v.owner_id is null or v.owner_id=p_user) and coalesce(p.due_date,(p.due_at at time zone tz)::date)<=public.study_local_date(now(),tz)),
 'masteredWords',(select count(*) from public.vocabulary_progress p join public.vocabulary v on v.id=p.vocabulary_id where p.user_id=p_user and p.status='mastered' and v.review_status='reviewed' and (v.owner_id is null or v.owner_id=p_user)));
 foreach mod_name in array array['verbal','quant'] loop
  select count(*),count(*) filter(where a.is_correct) into attempts,correct from public.practice_attempts a join public.questions q on q.id=a.question_id where a.user_id=p_user and coalesce(a.question_snapshot->>'module',q.module)=mod_name and a.attempted_at>=now()-interval '30 days';
  weak=null;select coalesce(a.question_snapshot->>'type',q.question_type) into weak from public.practice_attempts a join public.questions q on q.id=a.question_id where a.user_id=p_user and coalesce(a.question_snapshot->>'module',q.module)=mod_name and a.attempted_at>=now()-interval '30 days' group by coalesce(a.question_snapshot->>'type',q.question_type) having count(*)>=3 order by avg(case when a.is_correct then 0 else 1 end) desc,count(*) desc,coalesce(a.question_snapshot->>'type',q.question_type) limit 1;
  result=result||jsonb_build_object(mod_name,jsonb_build_object('attempts',attempts,'correct',correct,'weakType',weak));
 end loop;return result;
end;$$;

create function public.practice_complete_tasks(p_user uuid,p_date date,p_now timestamptz) returns void language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.daily_checkins where user_id=p_user and local_date=p_date) then return;end if;
 update public.daily_tasks t set completed_at=p_now,completion_source='automatic' where t.user_id=p_user and t.local_date=p_date and t.completed_at is null and t.task_key in ('verbal','quant') and t.target<=(select count(distinct a.question_id) from public.practice_attempts a join public.questions q on q.id=a.question_id where a.user_id=p_user and a.local_date=p_date and a.request_input is not null and coalesce(a.question_snapshot->>'module',q.module)=t.task_key);
 update public.daily_tasks t set completed_at=p_now,completion_source='automatic' where t.user_id=p_user and t.local_date=p_date and t.task_key='mistakes' and t.completed_at is null and t.target<=(select count(*) from public.mistake_records m where m.user_id=p_user and m.reviewed_on=p_date);
end;$$;
alter function public.study_action(jsonb) rename to study_action_phase3;
create function public.study_action(p_action jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin snapshot=public.study_action_phase2(p_action);perform public.vocab_complete_tasks(auth.uid(),(snapshot->>'today')::date,clock_timestamp());perform public.practice_complete_tasks(auth.uid(),(snapshot->>'today')::date,clock_timestamp());return snapshot||jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(t)-'user_id'-'notes' order by t.local_date,t.task_key) from public.daily_tasks t where t.user_id=auth.uid()),'[]'));end;$$;

create function public.practice_action(p_action jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid=auth.uid();settings public.user_settings;at_time timestamptz;today date;kind text=p_action->>'kind';
 sid uuid;request_id uuid;entry public.practice_sessions;existing public.practice_attempts;mistake public.mistake_records;
 question jsonb;solution jsonb;provided_answer jsonb;correct boolean;elapsed integer;answered integer;requested_count integer;requested_minutes integer;
 requested_module text;filters jsonb;chosen jsonb;note_value text;qid uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if kind is null or kind not in ('ensure','start','submit','end','favorite','mistake') then raise exception 'INVALID_ACTION';end if;
 select * into settings from public.user_settings where user_id=uid for update;if not found then raise exception 'SETTINGS_REQUIRED';end if;
 at_time=clock_timestamp();today=public.study_local_date(at_time,settings.timezone);
 if kind in ('start','submit','mistake') and (p_action->>'date' is null or p_action->>'date'<>today::text) then raise exception 'DAY_CHANGED';end if;
 if kind='favorite' then
  qid=(p_action->>'questionId')::uuid;question=public.practice_question(qid);if question is null then raise exception 'QUESTION_NOT_FOUND';end if;
  if jsonb_typeof(p_action->'value') is distinct from 'boolean' then raise exception 'INVALID_FAVORITE';end if;
  if (p_action->>'value')::boolean then insert into public.question_bookmarks(user_id,question_id) values(uid,qid) on conflict(user_id,question_id) do nothing;
  else delete from public.question_bookmarks b where b.user_id=uid and b.question_id=qid;end if;
 end if;
 if kind='start' then
  sid=(p_action->>'id')::uuid;if sid is null then raise exception 'SESSION_SETTINGS';end if;
  select * into entry from public.practice_sessions where id=sid;
  if found then
   if entry.user_id<>uid or entry.start_input is distinct from p_action then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else
   requested_module=p_action->>'module';if requested_module is null or requested_module not in ('verbal','quant') then raise exception 'SESSION_SETTINGS';end if;
   if jsonb_typeof(p_action->'count') is distinct from 'number' or (p_action->>'count')::numeric<>trunc((p_action->>'count')::numeric) then raise exception 'SESSION_SETTINGS';end if;
   requested_count=(p_action->>'count')::integer;if requested_count not between 1 and 20 then raise exception 'SESSION_SETTINGS';end if;
   requested_minutes=null;if p_action->'minutes' is distinct from 'null'::jsonb then
    if jsonb_typeof(p_action->'minutes') is distinct from 'number' or (p_action->>'minutes')::numeric<>trunc((p_action->>'minutes')::numeric) then raise exception 'SESSION_SETTINGS';end if;
    requested_minutes=(p_action->>'minutes')::integer;if requested_minutes not between 1 and 120 then raise exception 'SESSION_SETTINGS';end if;
   end if;
   filters=p_action->'filter';if jsonb_typeof(filters) is distinct from 'object' or exists(select 1 from jsonb_object_keys(filters) k where k not in ('type','category','difficulty','tag','favorites','questionId')) then raise exception 'SESSION_FILTER';end if;
   if filters?'difficulty' and (jsonb_typeof(filters->'difficulty') is distinct from 'number' or (filters->>'difficulty')::numeric<>trunc((filters->>'difficulty')::numeric) or (filters->>'difficulty')::numeric not between 1 and 5) then raise exception 'SESSION_FILTER';end if;
   if filters?'favorites' and jsonb_typeof(filters->'favorites') is distinct from 'boolean' then raise exception 'SESSION_FILTER';end if;
   select coalesce(jsonb_agg(z.id order by z.attempted,z.id),'[]') into chosen from (
    select q.id,exists(select 1 from public.practice_attempts a where a.user_id=uid and a.local_date=today and a.question_id=q.id) attempted from public.questions q
    where q.module=requested_module and q.review_status='reviewed' and exists(select 1 from public.question_solutions s where s.question_id=q.id)
     and (not filters?'type' or q.question_type=filters->>'type') and (not filters?'category' or q.content->>'category'=filters->>'category') and (not filters?'difficulty' or q.difficulty=(filters->>'difficulty')::integer) and (not filters?'tag' or q.content->'tags'? (filters->>'tag')) and (not filters?'questionId' or q.id=(filters->>'questionId')::uuid) and (coalesce((filters->>'favorites')::boolean,false)=false or exists(select 1 from public.question_bookmarks b where b.user_id=uid and b.question_id=q.id))
    order by attempted,q.id limit requested_count
   ) z;
   if jsonb_array_length(chosen)=0 then raise exception 'NO_QUESTIONS';end if;
   if public.study_action('{"kind":"ensure"}')->>'today'<>today::text then raise exception 'DAY_CHANGED';end if;
   update public.practice_sessions set ended_at=at_time where user_id=uid and module=requested_module and ended_at is null;
   insert into public.practice_sessions(id,user_id,module,started_at,local_date,timezone,question_ids,deadline_at,current_started_at,start_input) values(sid,uid,requested_module,at_time,today,settings.timezone,chosen,case when requested_minutes is not null then at_time+requested_minutes*interval '1 minute' end,at_time,p_action);
  end if;
 end if;
 if kind='end' then
  update public.practice_sessions set ended_at=coalesce(ended_at,at_time) where id=(p_action->>'sessionId')::uuid and user_id=uid;if not found then raise exception 'SESSION_NOT_FOUND';end if;
 end if;
 if kind='submit' then
  request_id=(p_action->>'id')::uuid;if request_id is null then raise exception 'INVALID_REQUEST';end if;
  select * into existing from public.practice_attempts where id=request_id;
  if found then
   if existing.user_id<>uid or existing.request_input is distinct from p_action then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else
   select * into entry from public.practice_sessions where id=(p_action->>'sessionId')::uuid and user_id=uid;if not found then raise exception 'SESSION_NOT_FOUND';end if;
   if entry.ended_at is not null then raise exception 'SESSION_ENDED';end if;
   if entry.local_date<>today or entry.timezone<>settings.timezone then raise exception 'SESSION_DATE_CHANGED';end if;
   if entry.deadline_at is not null and at_time>=entry.deadline_at then raise exception 'SESSION_EXPIRED';end if;
   select count(*) into answered from public.practice_attempts where session_id=entry.id and request_input is not null;
   qid=(p_action->>'questionId')::uuid;if (entry.question_ids->>answered) is distinct from qid::text then raise exception 'QUESTION_ORDER';end if;
   question=public.practice_question(qid);if question is null then raise exception 'QUESTION_NOT_FOUND';end if;
   if p_action->>'revision' is null or (p_action->>'revision')::integer<>(question->>'revision')::integer then raise exception 'QUESTION_CHANGED';end if;
   select s.solution into solution from public.question_solutions s where s.question_id=qid;if solution is null then raise exception 'SOLUTION_UNAVAILABLE';end if;
   provided_answer=p_action->'answer';correct=public.practice_grade(question,solution,provided_answer);
   elapsed=least(86400,greatest(0,floor(extract(epoch from at_time-entry.current_started_at))::integer));
   insert into public.practice_attempts(id,user_id,session_id,question_id,answer,is_correct,attempted_at,local_date,elapsed_seconds,question_revision,question_snapshot,feedback,request_input) values(request_id,uid,entry.id,qid,provided_answer,correct,at_time,today,elapsed,(question->>'revision')::integer,question,solution,p_action);
   update public.practice_sessions set current_started_at=at_time,ended_at=case when answered+1>=jsonb_array_length(question_ids) then at_time end where id=entry.id;
   if not correct then
    insert into public.mistake_records(user_id,question_id,wrong_answer,last_wrong_answer,first_attempt_id,last_attempt_id,last_wrong_at) values(uid,qid,provided_answer,provided_answer,request_id,request_id,at_time)
    on conflict(user_id,question_id) do update set frequency=public.mistake_records.frequency+1,last_wrong_answer=excluded.last_wrong_answer,last_attempt_id=excluded.last_attempt_id,last_wrong_at=excluded.last_wrong_at,mastered=false,revision=public.mistake_records.revision+1;
   end if;
   perform public.practice_complete_tasks(uid,today,at_time);
  end if;
 end if;
 if kind='mistake' then
  select * into mistake from public.mistake_records where id=(p_action->>'mistakeId')::uuid and user_id=uid;if not found then raise exception 'MISTAKE_NOT_FOUND';end if;
  if p_action->>'revision' is null or (p_action->>'revision')::integer<>mistake.revision then raise exception 'STALE_MISTAKE';end if;
  note_value=p_action->>'reason';if note_value is null or length(note_value)>2000 or jsonb_typeof(p_action->'mastered') is distinct from 'boolean' then raise exception 'INVALID_MISTAKE';end if;
  perform public.study_action('{"kind":"ensure"}');
  update public.mistake_records set reason=note_value,mastered=(p_action->>'mastered')::boolean,reviewed_on=today,revision=revision+1 where id=mistake.id;
  perform public.practice_complete_tasks(uid,today,at_time);
 end if;
 return jsonb_build_object('today',today::text,'server_now',at_time,
  'questions',coalesce((select jsonb_agg(public.practice_question(q.id) order by q.id) from public.questions q where q.review_status='reviewed' and exists(select 1 from public.question_solutions s where s.question_id=q.id)),'[]'),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s)-'user_id' order by s.started_at,s.id) from public.practice_sessions s where s.user_id=uid and s.start_input is not null),'[]'),
  'attempts',coalesce((select jsonb_agg(to_jsonb(a)-'user_id' order by a.attempted_at,a.id) from public.practice_attempts a where a.user_id=uid and a.feedback is not null and a.question_snapshot is not null),'[]'),
  'mistakes',coalesce((select jsonb_agg(to_jsonb(m)-'user_id' order by m.frequency desc,m.last_wrong_at desc,m.id) from public.mistake_records m where m.user_id=uid and m.first_attempt_id is not null),'[]'),
  'bookmarks',coalesce((select jsonb_agg(jsonb_build_object('question_id',b.question_id) order by b.question_id) from public.question_bookmarks b where b.user_id=uid),'[]')
 );
end;$$;
revoke all on function public.practice_question(uuid),public.practice_number(text),public.practice_grade(jsonb,jsonb,jsonb),public.practice_complete_tasks(uuid,date,timestamptz),public.study_action_phase3(jsonb),public.study_action(jsonb),public.practice_action(jsonb) from public,anon,authenticated;
grant execute on function public.study_action(jsonb),public.practice_action(jsonb) to authenticated;
commit;
