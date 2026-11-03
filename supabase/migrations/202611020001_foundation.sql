-- Phase 1: schema foundation. Apply once through Supabase migrations or SQL editor.
begin;
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.user_settings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 50),
 target_score integer not null default 320 check(target_score between 260 and 340),
 exam_date date,
 daily_minutes integer not null default 60 check(daily_minutes in (30,60,90)),
 new_words integer not null default 15 check(new_words between 1 and 100),
 english_level text not null default 'intermediate' check(english_level in ('foundation','intermediate','advanced')),
 timezone text not null default 'Asia/Kuala_Lumpur',
 updated_at timestamptz not null default now()
);
create function public.validate_settings() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid IANA timezone'; end if;
 new.updated_at=now();return new;
end;$$;
create trigger validate_settings before insert or update on public.user_settings for each row execute function public.validate_settings();
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id);return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id) select id from auth.users on conflict do nothing;

create table public.vocabulary (
 id uuid primary key default gen_random_uuid(), word text not null unique,
 content jsonb not null default '{}', source text not null default 'original',
 review_status text not null default 'draft' check(review_status in ('draft','reviewed','rejected'))
);
create table public.vocabulary_progress (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 vocabulary_id uuid not null references public.vocabulary(id),repetitions integer not null default 0 check(repetitions>=0),
 interval_days integer not null default 0 check(interval_days>=0),ease_factor numeric not null default 2.5 check(ease_factor>=1.3),
 due_at timestamptz not null default now(),status text not null default 'new' check(status in ('new','learning','review','mastered')),
 favorite boolean not null default false,unique(user_id,vocabulary_id)
);
create table public.questions (
 id uuid primary key default gen_random_uuid(),module text not null check(module in ('verbal','quant')),
 question_type text not null,difficulty integer not null check(difficulty between 1 and 5),
 prompt text not null,source text not null default 'original',content jsonb not null default '{}',
 review_status text not null default 'draft' check(review_status in ('draft','reviewed','rejected'))
);
create table public.question_options (
 id uuid primary key default gen_random_uuid(),question_id uuid not null references public.questions(id) on delete cascade,
 option_key text not null,content text not null,unique(question_id,option_key)
);
-- Answer rules and scoring RPC will be added in Phase 4; never accept client-supplied scores as authoritative.
create table public.practice_sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 module text not null check(module in ('verbal','quant','vocabulary')),started_at timestamptz not null default now(),ended_at timestamptz,
 unique(id,user_id),check(ended_at is null or ended_at>=started_at)
);
create table public.practice_attempts (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null,question_id uuid not null references public.questions(id),
 answer jsonb not null,is_correct boolean not null,attempted_at timestamptz not null default now(),
 foreign key(session_id,user_id) references public.practice_sessions(id,user_id) on delete cascade
);
create table public.daily_tasks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null,task_key text not null,target integer not null check(target>0),
 completed_at timestamptz,notes text not null default '',unique(user_id,local_date,task_key)
);
create table public.daily_checkins (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null,timezone text not null,created_at timestamptz not null default now(),unique(user_id,local_date)
);
create table public.mistake_records (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 question_id uuid not null references public.questions(id),wrong_answer jsonb not null,
 frequency integer not null default 1 check(frequency>0),reason text not null default '',mastered boolean not null default false,
 last_wrong_at timestamptz not null default now(),unique(user_id,question_id)
);
create table public.writing_submissions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 prompt text not null,body text not null default '',notes text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index vocabulary_due_idx on public.vocabulary_progress(user_id,due_at);
create index attempts_user_time_idx on public.practice_attempts(user_id,attempted_at);
create index sessions_user_time_idx on public.practice_sessions(user_id,started_at);
create index mistakes_frequency_idx on public.mistake_records(user_id,frequency desc);
create index writing_user_time_idx on public.writing_submissions(user_id,updated_at);
create index questions_filter_idx on public.questions(module,question_type,difficulty) where review_status='reviewed';

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid())=id);
do $$ declare tbl text;begin
 foreach tbl in array array['user_settings','vocabulary_progress','practice_sessions','practice_attempts','daily_tasks','daily_checkins','mistake_records','writing_submissions'] loop
  execute format('alter table public.%I enable row level security',tbl);
  -- Only settings have a browser write path in Phase 1. Later modules remain read-only until their server rules exist.
  execute format('revoke all on public.%I from anon, authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',tbl);
 end loop;
end $$;
grant insert,update on public.user_settings to authenticated;
create policy owner_insert on public.user_settings for insert to authenticated with check((select auth.uid())=user_id);
create policy owner_update on public.user_settings for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
alter table public.vocabulary enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
revoke all on public.vocabulary,public.questions,public.question_options from anon,authenticated;
grant select on public.vocabulary,public.questions,public.question_options to authenticated;
create policy reviewed_vocabulary on public.vocabulary for select to authenticated using(review_status='reviewed');
create policy reviewed_questions on public.questions for select to authenticated using(review_status='reviewed');
create policy reviewed_options on public.question_options for select to authenticated using(exists(select 1 from public.questions q where q.id=question_id and q.review_status='reviewed'));
revoke all on function public.handle_new_user() from public;
commit;
