-- Phase 3: private imports, durable vocabulary events and server-graded SM-2.
begin;
alter table public.vocabulary add column owner_id uuid references public.profiles(id) on delete cascade;
alter table public.vocabulary drop constraint vocabulary_word_key;
create unique index vocabulary_public_word on public.vocabulary(lower(word)) where owner_id is null;
create unique index vocabulary_private_word on public.vocabulary(owner_id,lower(word)) where owner_id is not null;
drop policy reviewed_vocabulary on public.vocabulary;
create policy visible_vocabulary on public.vocabulary for select to authenticated using(review_status='reviewed' and (owner_id is null or owner_id=(select auth.uid())));
alter table public.vocabulary_progress add column due_date date;
alter table public.vocabulary_progress add column last_reviewed_at timestamptz;
alter table public.vocabulary_progress add column revision integer not null default 0 check(revision>=0);
alter table public.vocabulary_progress add column lapses integer not null default 0 check(lapses>=0);
update public.vocabulary_progress p set due_date=(p.due_at at time zone coalesce(s.timezone,'Asia/Kuala_Lumpur'))::date from public.user_settings s where s.user_id=p.user_id and p.status<>'new';
create index vocabulary_local_due on public.vocabulary_progress(user_id,due_date) where status<>'new';
create table public.vocabulary_reviews (
 id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,
 vocabulary_id uuid not null references public.vocabulary(id),local_date date not null,
 mode text not null check(mode in ('card','spelling','choice')),answer text not null check(length(answer)<=1500),
 quality integer not null check(quality between 0 and 5),correct boolean not null,
 kind text not null check(kind in ('new','review','extra')),scheduled boolean not null,input jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(user_id,vocabulary_id) references public.vocabulary_progress(user_id,vocabulary_id) on delete cascade
);
alter table public.vocabulary_reviews enable row level security;
revoke all on public.vocabulary_reviews from public,anon,authenticated;
grant select on public.vocabulary_reviews to authenticated;
create policy owner_read on public.vocabulary_reviews for select to authenticated using((select auth.uid())=user_id);
create index vocabulary_reviews_day on public.vocabulary_reviews(user_id,local_date,kind);
create index vocabulary_reviews_word on public.vocabulary_reviews(user_id,vocabulary_id,created_at);

create function public.vocab_content_valid(p_content jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare key text;item jsonb;
begin
 if jsonb_typeof(p_content) is distinct from 'object' then return false;end if;
 foreach key in array array['word','ipa','part_of_speech','definition_en','definition_zh','example_en','example_zh'] loop
  if jsonb_typeof(p_content->key) is distinct from 'string' or length(p_content->>key)>1500 or (key<>'ipa' and length(btrim(p_content->>key))=0) then return false;end if;
 end loop;
 if length(p_content->>'word')>80 or length(p_content->>'ipa')>100 or p_content->>'word' !~ '^[A-Za-z]+([- '' ][A-Za-z]+)*$' then return false;end if;
 if jsonb_typeof(p_content->'difficulty') is distinct from 'number' then return false;end if;
 if (p_content->>'difficulty')::numeric<>trunc((p_content->>'difficulty')::numeric) or (p_content->>'difficulty')::numeric not between 1 and 5 then return false;end if;
 foreach key in array array['synonyms','antonyms','tags'] loop
  if jsonb_typeof(p_content->key) is distinct from 'array' then return false;end if;
  if jsonb_array_length(p_content->key)>20 then return false;end if;
  for item in select value from jsonb_array_elements(p_content->key) loop
   if jsonb_typeof(item) is distinct from 'string' or length(btrim(item#>>'{}')) not between 1 and 1500 then return false;end if;
  end loop;
 end loop;return true;
end;$$;
alter table public.vocabulary add constraint reviewed_content_valid check(review_status<>'reviewed' or public.vocab_content_valid(content)) not valid;

create function public.vocab_sm2(p_repetitions integer,p_interval integer,p_ease numeric,p_quality integer,p_date date) returns jsonb
language plpgsql immutable set search_path='' as $$
declare reps integer;days integer;ease numeric;
begin
 if p_quality is null or p_quality not between 0 and 5 then raise exception 'INVALID_QUALITY';end if;
 reps=case when p_quality<3 then 0 else p_repetitions+1 end;
 days=case when p_quality<3 or reps=1 then 1 when reps=2 then 6 else greatest(1,least(365,ceil(p_interval*p_ease)::integer)) end;
 ease=greatest(1.3,round(p_ease+.1-(5-p_quality)*(.08+(5-p_quality)*.02),2));
 return jsonb_build_object('repetitions',reps,'interval_days',days,'ease_factor',ease,'due_date',(p_date+days)::text,'status',case when p_quality<3 then 'learning' when reps>=3 and days>=15 then 'mastered' else 'review' end);
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
  select count(*),count(*) filter(where a.is_correct) into attempts,correct from public.practice_attempts a join public.questions q on q.id=a.question_id where a.user_id=p_user and q.module=mod_name and a.attempted_at>=now()-interval '30 days';
  weak=null;select q.question_type into weak from public.practice_attempts a join public.questions q on q.id=a.question_id where a.user_id=p_user and q.module=mod_name and a.attempted_at>=now()-interval '30 days' group by q.question_type having count(*)>=3 order by avg(case when a.is_correct then 0 else 1 end) desc,count(*) desc,q.question_type limit 1;
  result=result||jsonb_build_object(mod_name,jsonb_build_object('attempts',attempts,'correct',correct,'weakType',weak));
 end loop;return result;
end;$$;

create function public.vocab_complete_tasks(p_user uuid,p_date date,p_now timestamptz) returns void
language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.daily_checkins where user_id=p_user and local_date=p_date) then return;end if;
 update public.daily_tasks t set completed_at=p_now,completion_source='automatic' where t.user_id=p_user and t.local_date=p_date and t.completed_at is null and t.task_key in ('new_words','review_words') and t.target<=(select count(distinct r.vocabulary_id) from public.vocabulary_reviews r where r.user_id=p_user and r.local_date=p_date and r.kind=case when t.task_key='new_words' then 'new' else 'review' end);
end;$$;
alter function public.study_action(jsonb) rename to study_action_phase2;
create function public.study_action(p_action jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;
begin
 snapshot=public.study_action_phase2(p_action);
 perform public.vocab_complete_tasks(auth.uid(),(snapshot->>'today')::date,clock_timestamp());
 return public.study_action_phase2('{"kind":"ensure"}');
end;$$;

create function public.vocab_action(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();settings public.user_settings;today date;at_time timestamptz;kind text=p_action->>'kind';entry public.vocabulary;p public.vocabulary_progress;existing public.vocabulary_reviews;imported_content jsonb;imported integer=0;quality integer;mode text;answer text;first boolean;due boolean;scheduled boolean;step jsonb;request_id uuid;
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if kind is null or kind not in ('ensure','favorite','import','review') then raise exception 'INVALID_ACTION';end if;
 select * into settings from public.user_settings where user_id=uid for update;if not found then raise exception 'SETTINGS_REQUIRED';end if;
 at_time=clock_timestamp();today=public.study_local_date(at_time,settings.timezone);
 if kind='import' then
  if p_action->'reviewed' is distinct from 'true'::jsonb then raise exception 'IMPORT_REVIEW_REQUIRED';end if;
  if jsonb_typeof(p_action->'words') is distinct from 'array' then raise exception 'INVALID_IMPORT';end if;
  if jsonb_array_length(p_action->'words') not between 1 and 200 then raise exception 'INVALID_IMPORT';end if;
  for imported_content in select value from jsonb_array_elements(p_action->'words') loop
   if not public.vocab_content_valid(imported_content) then raise exception 'INVALID_CONTENT';end if;
   if not exists(select 1 from public.vocabulary where review_status='reviewed' and (owner_id is null or owner_id=uid) and lower(word)=lower(imported_content->>'word')) then
    insert into public.vocabulary(word,content,source,review_status,owner_id) values(imported_content->>'word',imported_content,'user-import','reviewed',uid);imported=imported+1;
   end if;
  end loop;
 end if;
 if kind in ('favorite','review') then
  select * into entry from public.vocabulary where id=(p_action->>'wordId')::uuid and review_status='reviewed' and (owner_id is null or owner_id=uid);if not found then raise exception 'WORD_NOT_FOUND';end if;
  insert into public.vocabulary_progress(user_id,vocabulary_id) values(uid,entry.id) on conflict(user_id,vocabulary_id) do nothing;
  select * into p from public.vocabulary_progress where user_id=uid and vocabulary_id=entry.id;
  if kind='favorite' then
   if jsonb_typeof(p_action->'value') is distinct from 'boolean' then raise exception 'INVALID_FAVORITE';end if;
   update public.vocabulary_progress set favorite=(p_action->>'value')::boolean where id=p.id;
  else
   if p_action->>'date' is null or p_action->>'date'<>today::text then raise exception 'DAY_CHANGED';end if;
   request_id=(p_action->>'id')::uuid;if request_id is null then raise exception 'INVALID_REVIEW';end if;
   select * into existing from public.vocabulary_reviews where id=request_id;
   if found then
    if existing.user_id<>uid or existing.input<>p_action then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   else
    if p_action->>'revision' is null or p.revision<>(p_action->>'revision')::integer then raise exception 'STALE_REVIEW';end if;
    mode=p_action->>'mode';answer=p_action->>'answer';if mode is null or mode not in ('card','spelling','choice') or answer is null or length(answer)>1500 then raise exception 'INVALID_REVIEW';end if;
    if mode='card' then
     if jsonb_typeof(p_action->'quality') is distinct from 'number' or (p_action->>'quality')::numeric<>trunc((p_action->>'quality')::numeric) then raise exception 'INVALID_QUALITY';end if;
     quality=(p_action->>'quality')::integer;
    elsif mode='spelling' then quality=case when lower(btrim(answer))=lower(entry.word) then 4 else 1 end;
    else quality=case when answer=entry.id::text then 4 else 1 end;end if;
    if quality is null or quality not between 0 and 5 then raise exception 'INVALID_QUALITY';end if;
    -- Freeze today's plan using due counts BEFORE this answer changes the schedule.
    perform public.study_action_phase2('{"kind":"ensure"}');
    first=p.status='new';due=p.status<>'new' and coalesce(p.due_date,(p.due_at at time zone settings.timezone)::date)<=today;scheduled=first or due or quality<3;
    if scheduled then
     step=public.vocab_sm2(p.repetitions,p.interval_days,p.ease_factor,quality,today);
     update public.vocabulary_progress set repetitions=(step->>'repetitions')::integer,interval_days=(step->>'interval_days')::integer,ease_factor=(step->>'ease_factor')::numeric,due_date=(step->>'due_date')::date,due_at=((step->>'due_date')::date::timestamp at time zone settings.timezone),status=step->>'status',lapses=lapses+case when quality<3 then 1 else 0 end where id=p.id;
    end if;
    update public.vocabulary_progress set revision=revision+1,last_reviewed_at=at_time where id=p.id;
    insert into public.vocabulary_reviews(id,user_id,vocabulary_id,local_date,mode,answer,quality,correct,kind,scheduled,input,created_at) values(request_id,uid,entry.id,today,mode,answer,quality,quality>=3,case when first then 'new' when due then 'review' else 'extra' end,scheduled,p_action,at_time);
    perform public.vocab_complete_tasks(uid,today,at_time);
   end if;
  end if;
 end if;
 return jsonb_build_object('new_word_target',coalesce((select target from public.daily_tasks where user_id=uid and local_date=today and task_key='new_words'),least(settings.new_words,floor(settings.daily_minutes*.3)::integer)),'today',today::text,'words',coalesce((select jsonb_agg(v.content||jsonb_build_object('id',v.id,'word',v.word,'source',v.source,'owner_id',v.owner_id,'review_status',v.review_status) order by lower(v.word),v.id) from public.vocabulary v where v.review_status='reviewed' and (v.owner_id is null or v.owner_id=uid)),'[]'),'progress',coalesce((select jsonb_agg(jsonb_build_object('vocabulary_id',vocabulary_id,'repetitions',repetitions,'interval_days',interval_days,'ease_factor',ease_factor,'due_date',due_date,'status',status,'favorite',favorite,'last_reviewed_at',last_reviewed_at,'revision',revision,'lapses',lapses)) from public.vocabulary_progress where user_id=uid),'[]'),'reviews',coalesce((select jsonb_agg(to_jsonb(r)-'user_id' order by r.created_at,r.id) from public.vocabulary_reviews r where r.user_id=uid),'[]'),'imported',imported);
end;$$;

revoke all on function public.vocab_content_valid(jsonb),public.vocab_sm2(integer,integer,numeric,integer,date),public.vocab_complete_tasks(uuid,date,timestamptz),public.study_action_phase2(jsonb),public.study_action(jsonb),public.vocab_action(jsonb),public.study_signals(uuid) from public,anon,authenticated;
grant execute on function public.study_action(jsonb),public.vocab_action(jsonb) to authenticated;
commit;
