begin;
create table public.writing_prompts(id text primary key, title text not null, prompt text not null, source text not null default 'original:gre-pilot:ai-assisted:author-reviewed', review_status text not null check(review_status in ('draft','reviewed')));
alter table public.writing_prompts enable row level security;
grant select on public.writing_prompts to authenticated;
create policy reviewed_prompts on public.writing_prompts for select to authenticated using(review_status='reviewed');
alter table public.writing_submissions
 add column prompt_id text references public.writing_prompts(id),
 add column started_at timestamptz not null default now(),
 add column deadline_at timestamptz not null default now()+interval '30 minutes',
 add column completed_at timestamptz,
 add column local_date date not null default current_date,
 add column timezone text not null default 'Asia/Kuala_Lumpur',
 add column revision integer not null default 0 check(revision>=0),
 add column last_input jsonb,
 add column ai_feedback jsonb;
alter table public.writing_submissions add constraint writing_text_limits check(char_length(body)<=60000 and char_length(notes)<=10000);
create function public.writing_document(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',id,'prompt_id',coalesce(prompt_id,'legacy'),'prompt',prompt,'body',body,'notes',notes,'started_at',started_at,'deadline_at',deadline_at,'created_at',created_at,'updated_at',updated_at,'completed_at',completed_at,'local_date',local_date,'timezone',timezone,'revision',revision,'last_input',last_input,'ai_feedback',ai_feedback) from public.writing_submissions where id=p_id and user_id=auth.uid()
$$;
create function public.writing_action(p_action jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); zone text; stamp timestamptz; doc public.writing_submissions; promptrow public.writing_prompts; docid uuid; k text:=p_action->>'kind';
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select timezone into zone from public.user_settings where user_id=uid for update;
 if not found then raise exception 'SETTINGS_REQUIRED'; end if;
 stamp:=clock_timestamp();
 if k not in ('ensure','start','save','finish') or k is null then raise exception 'INVALID_ACTION'; end if;
 if k<>'ensure' then
  docid:=(p_action->>'id')::uuid;
  if docid is null then raise exception 'INVALID_ID'; end if;
  select * into doc from public.writing_submissions where id=docid and user_id=uid for update;
  if k='start' then
   select * into promptrow from public.writing_prompts where id=p_action->>'promptId' and review_status='reviewed';
   if not found then raise exception 'INVALID_PROMPT'; end if;
   if doc.id is not null then
    if doc.prompt_id<>promptrow.id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   else
    insert into public.writing_submissions(id,user_id,prompt_id,prompt,started_at,deadline_at,created_at,updated_at,local_date,timezone)
    values(docid,uid,promptrow.id,promptrow.prompt,stamp,stamp+interval '30 minutes',stamp,stamp,(stamp at time zone zone)::date,zone);
   end if;
  else
   if doc.id is null then raise exception 'DOCUMENT_NOT_FOUND'; end if;
   if doc.last_input is distinct from p_action then
    if jsonb_typeof(p_action->'body') is distinct from 'string' or jsonb_typeof(p_action->'notes') is distinct from 'string' or char_length(p_action->>'body')>60000 or char_length(p_action->>'notes')>10000 or (p_action->>'requestId')::uuid is null then raise exception 'INVALID_TEXT'; end if;
    if (p_action->>'revision')::integer is distinct from doc.revision then raise exception 'STALE_REVISION'; end if;
    if doc.completed_at is not null and (k='finish' or p_action->>'body'<>doc.body) then raise exception 'DOCUMENT_COMPLETED'; end if;
    if k='finish' and (p_action->>'body')!~'[A-Za-z0-9]' then raise exception 'EMPTY_ESSAY'; end if;
    update public.writing_submissions set body=p_action->>'body',notes=p_action->>'notes',revision=revision+1,updated_at=stamp,last_input=p_action,completed_at=case when k='finish' then stamp else completed_at end where id=docid and user_id=uid;
   end if;
  end if;
 end if;
 return jsonb_build_object('server_now',stamp,'today',(stamp at time zone zone)::date,'documents',coalesce((select jsonb_agg(public.writing_document(id) order by created_at,id) from public.writing_submissions where user_id=uid),'[]'::jsonb));
end $$;
revoke all on function public.writing_document(uuid),public.writing_action(jsonb) from public,anon,authenticated;
grant execute on function public.writing_action(jsonb) to authenticated;

-- Optional AI adapter: each authenticated owner can reserve at most 3 calls per UTC day.
create table public.writing_feedback_usage(user_id uuid not null references public.profiles(id) on delete cascade,utc_date date not null,requests integer not null,last_requested_at timestamptz not null,primary key(user_id,utc_date));
alter table public.writing_feedback_usage enable row level security;
revoke all on public.writing_feedback_usage from public,anon,authenticated;
create function public.writing_feedback_reserve(p_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); doc public.writing_submissions; stamp timestamptz; used public.writing_feedback_usage;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 perform 1 from public.user_settings where user_id=uid for update;
 select * into doc from public.writing_submissions where id=p_id and user_id=uid;
 if doc.id is null or doc.completed_at is null or doc.revision<>p_revision then raise exception 'COMPLETED_ESSAY_REQUIRED'; end if;
 stamp:=clock_timestamp();
 select * into used from public.writing_feedback_usage where user_id=uid and utc_date=(stamp at time zone 'UTC')::date;
 if used.requests>=3 or used.last_requested_at>stamp-interval '60 seconds' then raise exception 'FEEDBACK_RATE_LIMIT'; end if;
 insert into public.writing_feedback_usage values(uid,(stamp at time zone 'UTC')::date,1,stamp) on conflict(user_id,utc_date) do update set requests=writing_feedback_usage.requests+1,last_requested_at=stamp;
 return public.writing_document(p_id);
end $$;
create function public.writing_feedback_store(p_user uuid,p_id uuid,p_revision integer,p_feedback jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare k text;
begin
 if jsonb_typeof(p_feedback)<>'object' or (select count(*) from jsonb_object_keys(p_feedback))<>5 then raise exception 'INVALID_FEEDBACK'; end if;
 foreach k in array array['structure','logic','language','grammar','revision'] loop
  if jsonb_typeof(p_feedback->k) is distinct from 'string' or char_length(p_feedback->>k) not between 1 and 4000 then raise exception 'INVALID_FEEDBACK'; end if;
 end loop;
 update public.writing_submissions set ai_feedback=p_feedback where id=p_id and user_id=p_user and revision=p_revision and completed_at is not null;
 if not found then raise exception 'STALE_REVISION'; end if;
end $$;
revoke all on function public.writing_feedback_reserve(uuid,integer),public.writing_feedback_store(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.writing_feedback_reserve(uuid,integer) to authenticated;
grant execute on function public.writing_feedback_store(uuid,uuid,integer,jsonb) to service_role;
commit;
