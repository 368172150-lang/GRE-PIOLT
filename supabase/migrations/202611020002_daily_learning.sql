-- Phase 2. Apply AFTER foundation. All study writes go through one authenticated RPC.
begin;
create table public.study_days (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null,timezone text not null,budget integer not null check(budget in (30,60,90)),
 notes text not null default '' check(length(notes)<=2000),created_at timestamptz not null default now(),
 unique(user_id,local_date)
);
create table public.study_events (
 id uuid primary key, -- client request UUID is the idempotency key
 user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null,minutes integer not null check(minutes between 1 and 180),
 note text not null default '' check(length(note)<=2000),created_at timestamptz not null default now(),
 foreign key(user_id,local_date) references public.study_days(user_id,local_date) on delete cascade
);
alter table public.daily_tasks add column estimated_minutes numeric not null default 0 check(estimated_minutes>=0);
alter table public.daily_tasks add column focus_type text;
alter table public.daily_tasks add column completion_source text check(completion_source in ('manual','automatic'));
alter table public.study_days enable row level security;
alter table public.study_events enable row level security;
revoke all on public.study_days,public.study_events from public,anon,authenticated;
grant select on public.study_days,public.study_events to authenticated;
create policy owner_read on public.study_days for select to authenticated using((select auth.uid())=user_id);
create policy owner_read on public.study_events for select to authenticated using((select auth.uid())=user_id);
create index study_events_user_date on public.study_events(user_id,local_date);

-- Date helper accepts an instant solely for deterministic testing. RPC never accepts a client date as its clock.
create function public.study_local_date(p_now timestamptz,p_timezone text) returns date
language sql stable set search_path='' as $$ select (p_now at time zone p_timezone)::date $$;

create function public.study_plan_spec(p_budget integer,p_words integer,p_signals jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare
 result jsonb='[]';remaining numeric=p_budget;count_target integer;reviews integer;
 verbal_error numeric=0;quant_error numeric=0;first_module text='verbal';mod_name text;cost integer;share numeric;pool numeric;
begin
 if p_budget not in (30,60,90) or p_words not between 1 and 100 then raise exception 'INVALID_PLAN';end if;
 reviews=least((p_signals->>'dueReviews')::integer,floor(p_budget*.35/.5)::integer);
 if reviews>0 then
  result=result||jsonb_build_array(jsonb_build_object('task_key','review_words','target',reviews,'estimated_minutes',reviews*.5,'focus_type',null));remaining=remaining-reviews*.5;
 end if;
 count_target=least(p_words,floor(p_budget*.3)::integer,floor(remaining)::integer);
 if count_target>0 then result=result||jsonb_build_array(jsonb_build_object('task_key','new_words','target',count_target,'estimated_minutes',count_target,'focus_type',null));remaining=remaining-count_target;end if;
 result=result||jsonb_build_array(jsonb_build_object('task_key','mistakes','target',1,'estimated_minutes',3,'focus_type',null));remaining=remaining-3;
 if (p_signals#>>'{verbal,attempts}')::integer>=3 then verbal_error=1-(p_signals#>>'{verbal,correct}')::numeric/(p_signals#>>'{verbal,attempts}')::numeric;end if;
 if (p_signals#>>'{quant,attempts}')::integer>=3 then quant_error=1-(p_signals#>>'{quant,correct}')::numeric/(p_signals#>>'{quant,attempts}')::numeric;end if;
 if quant_error>verbal_error then first_module='quant';end if;
 pool=remaining;
 foreach mod_name in array case when first_module='quant' then array['quant','verbal'] else array['verbal','quant'] end loop
  cost=case when mod_name='verbal' then 3 else 2 end;share=case when mod_name=first_module then .6 else .4 end;
  count_target=floor(pool*share/cost)::integer;
  if count_target>0 then result=result||jsonb_build_array(jsonb_build_object('task_key',mod_name,'target',count_target,'estimated_minutes',count_target*cost,'focus_type',p_signals#>>array[mod_name,'weakType']));end if;
 end loop;
 return result||jsonb_build_array(jsonb_build_object('task_key','focus','target',p_budget,'estimated_minutes',0,'focus_type',null));
end;$$;

-- Internal helper. Never expose arbitrary user-id arguments through PostgREST.
create function public.study_signals(p_user uuid) returns jsonb
language plpgsql stable set search_path='' as $$
declare result jsonb;mod_name text;attempts integer;correct integer;weak text;
begin
 result=jsonb_build_object('dueReviews',(select count(*) from public.vocabulary_progress where user_id=p_user and status<>'new' and due_at<=now()),'masteredWords',(select count(*) from public.vocabulary_progress where user_id=p_user and status='mastered'));
 foreach mod_name in array array['verbal','quant'] loop
  select count(*),count(*) filter(where a.is_correct) into attempts,correct
  from public.practice_attempts a join public.questions q on q.id=a.question_id
  where a.user_id=p_user and q.module=mod_name and a.attempted_at>=now()-interval '30 days';
  weak=null;
  select q.question_type into weak from public.practice_attempts a join public.questions q on q.id=a.question_id
  where a.user_id=p_user and q.module=mod_name and a.attempted_at>=now()-interval '30 days'
  group by q.question_type having count(*)>=3
  order by avg(case when a.is_correct then 0 else 1 end) desc,count(*) desc,q.question_type limit 1;
  result=result||jsonb_build_object(mod_name,jsonb_build_object('attempts',attempts,'correct',correct,'weakType',weak));
 end loop;
 return result;
end;$$;

create function public.study_action(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid=auth.uid();settings public.user_settings;today date;day public.study_days;kind text=p_action->>'kind';
 checked boolean;signals jsonb;spec jsonb;specs jsonb;old_task public.daily_tasks;task public.daily_tasks;operation_at timestamptz;
 target_count integer;keep boolean;minutes integer;event_id uuid;old_event public.study_events;daily_minutes integer;note_value text;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if kind is null or kind not in ('ensure','replan','toggle','note','log','checkin') then raise exception 'INVALID_ACTION';end if;
 -- A per-user row lock serializes plan generation, writes, check-ins and timezone changes.
 select * into settings from public.user_settings where user_id=uid for update;
 if not found then raise exception 'SETTINGS_REQUIRED';end if;
 operation_at=clock_timestamp();today=public.study_local_date(operation_at,settings.timezone);
 if kind<>'ensure' and (p_action->>'date' is null or p_action->>'date'<>today::text) then raise exception 'DAY_CHANGED';end if;
 insert into public.study_days(user_id,local_date,timezone,budget,created_at) values(uid,today,settings.timezone,settings.daily_minutes,operation_at) on conflict(user_id,local_date) do nothing;
 select * into day from public.study_days where user_id=uid and local_date=today;
 checked=exists(select 1 from public.daily_checkins where user_id=uid and local_date=today);
 signals=public.study_signals(uid);
 if kind='replan' and checked then raise exception 'DAY_LOCKED';end if;
 if kind='replan' or not exists(select 1 from public.daily_tasks where user_id=uid and local_date=today) then
  specs=public.study_plan_spec(settings.daily_minutes,settings.new_words,signals);
  delete from public.daily_tasks where user_id=uid and local_date=today and task_key not in(select value->>'task_key' from jsonb_array_elements(specs));
  for spec in select value from jsonb_array_elements(specs) loop
   select * into old_task from public.daily_tasks where user_id=uid and local_date=today and task_key=spec->>'task_key';
   target_count=(spec->>'target')::integer;
   keep=old_task.completed_at is not null and old_task.target>=target_count and spec->>'task_key'<>'focus';
   insert into public.daily_tasks(user_id,local_date,task_key,target,estimated_minutes,focus_type,completed_at,completion_source)
   values(uid,today,spec->>'task_key',target_count,(spec->>'estimated_minutes')::numeric,spec->>'focus_type',case when keep then old_task.completed_at end,case when keep then old_task.completion_source end)
   on conflict(user_id,local_date,task_key) do update set target=excluded.target,estimated_minutes=excluded.estimated_minutes,focus_type=excluded.focus_type,completed_at=excluded.completed_at,completion_source=excluded.completion_source;
  end loop;
  update public.study_days set budget=settings.daily_minutes where user_id=uid and local_date=today;
 end if;
 if kind='toggle' then
  if checked then raise exception 'DAY_LOCKED';end if;
  if jsonb_typeof(p_action->'completed') is distinct from 'boolean' then raise exception 'INVALID_COMPLETION';end if;
  select * into task from public.daily_tasks where id=(p_action->>'taskId')::uuid and user_id=uid and local_date=today;
  if not found then raise exception 'TASK_NOT_FOUND';end if;
  if task.task_key='focus' then raise exception 'AUTOMATIC_TASK';end if;
  update public.daily_tasks set completed_at=case when (p_action->>'completed')::boolean then coalesce(completed_at,operation_at) end,completion_source=case when (p_action->>'completed')::boolean then 'manual' end where id=task.id;
 end if;
 if kind='note' then
  note_value=p_action->>'note';if note_value is null or length(note_value)>2000 then raise exception 'NOTE_TOO_LONG';end if;
  update public.study_days set notes=note_value where user_id=uid and local_date=today;
 end if;
 if kind='log' then
  if jsonb_typeof(p_action->'minutes') is distinct from 'number' or (p_action->>'minutes')::numeric<>trunc((p_action->>'minutes')::numeric) then raise exception 'INVALID_LOG';end if;
  minutes=(p_action->>'minutes')::integer;note_value=p_action->>'note';event_id=(p_action->>'id')::uuid;
  if minutes is null or minutes not between 1 and 180 or note_value is null or length(note_value)>2000 or event_id is null then raise exception 'INVALID_LOG';end if;
  select * into old_event from public.study_events where id=event_id;
  if found then
   if old_event.user_id<>uid or old_event.local_date<>today or old_event.minutes<>minutes or old_event.note<>note_value then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  else
   select coalesce(sum(e.minutes),0) into daily_minutes from public.study_events e where user_id=uid and local_date=today;
   if daily_minutes+minutes>1440 then raise exception 'DAILY_LIMIT';end if;
   insert into public.study_events(id,user_id,local_date,minutes,note,created_at) values(event_id,uid,today,minutes,note_value,operation_at);
  end if;
 end if;
 select coalesce(sum(e.minutes),0) into daily_minutes from public.study_events e where user_id=uid and local_date=today;
 update public.daily_tasks set completed_at=case when daily_minutes>=target then coalesce(completed_at,operation_at) end,completion_source=case when daily_minutes>=target then 'automatic' end where user_id=uid and local_date=today and task_key='focus';
 if kind='checkin' and not checked then
  if not exists(select 1 from public.daily_tasks where user_id=uid and local_date=today) or exists(select 1 from public.daily_tasks where user_id=uid and local_date=today and completed_at is null) then raise exception 'TASKS_INCOMPLETE';end if;
  insert into public.daily_checkins(user_id,local_date,timezone,created_at) values(uid,today,day.timezone,operation_at) on conflict(user_id,local_date) do nothing;
 end if;
 return jsonb_build_object(
  'today',today::text,
  'days',coalesce((select jsonb_agg(to_jsonb(d)-'user_id' order by d.local_date) from public.study_days d where d.user_id=uid),'[]'),
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'user_id'-'notes' order by t.local_date,t.task_key) from public.daily_tasks t where t.user_id=uid),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(e)-'user_id' order by e.created_at,e.id) from public.study_events e where e.user_id=uid),'[]'),
  'checkins',coalesce((select jsonb_agg(to_jsonb(c)-'user_id' order by c.local_date) from public.daily_checkins c where c.user_id=uid),'[]'),
  'signals',signals
 );
end;$$;

-- Explicit ACLs also override Supabase default function privileges.
revoke all on function public.study_local_date(timestamptz,text),public.study_plan_spec(integer,integer,jsonb),public.study_signals(uuid),public.study_action(jsonb) from public,anon,authenticated;
grant execute on function public.study_action(jsonb) to authenticated;
commit;
