-- Run with psql as postgres against a DISPOSABLE Supabase test database after the migration.
-- Any failed assertion aborts; all fixtures roll back. This has not been executed without a database.
begin;
insert into auth.users(id,email) values
 ('10000000-0000-4000-8000-000000000001','rls-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','rls-b@example.invalid');
insert into public.user_settings(user_id,display_name) values
 ('10000000-0000-4000-8000-000000000001','A'),
 ('10000000-0000-4000-8000-000000000002','B');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select count(*) from public.user_settings)<>1 then raise exception 'RLS leaked rows';end if;
 if (select display_name from public.user_settings)<>'A' then raise exception 'Wrong owner';end if;
 update public.user_settings set display_name='intrusion' where user_id='10000000-0000-4000-8000-000000000002';
 if found then raise exception 'Cross-account update succeeded';end if;
 begin
  update public.user_settings set user_id='10000000-0000-4000-8000-000000000003' where user_id='10000000-0000-4000-8000-000000000001';
  raise exception 'Ownership transfer succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 if (select display_name from public.user_settings where user_id='10000000-0000-4000-8000-000000000002')<>'B' then raise exception 'Other user modified';end if;
end $$;
rollback;
