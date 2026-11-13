-- Supabase Auth is the account lifecycle authority. Public signup must be
-- disabled in Auth settings before this migration is applied.
-- Profiles remain as internal historical references for assets and audits.
alter table public.it_members drop constraint it_members_user_id_fkey;
drop trigger record_change on public.it_members;

create function private.sync_auth_inventory_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  if tg_op = 'DELETE' then
    update public.it_members set active=false, updated_at=now(), version=version+1 where user_id=old.id;
    return old;
  end if;
  -- Authorization metadata is administrator-controlled app_metadata. Editable
  -- user_metadata is used for a display name only, never for permissions.
  v_role := case when new.raw_app_meta_data->>'inventory_role' in ('IT Admin','IT Officer')
    then new.raw_app_meta_data->>'inventory_role'
    else coalesce((select role from public.it_members where user_id=new.id),'IT Officer') end;
  insert into public.it_members(user_id,display_name,role,active)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(new.email,''),new.id::text),100),
    v_role,new.deleted_at is null and not coalesce(new.is_anonymous,false))
  on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active,
    updated_at=now(),version=public.it_members.version+1;
  return new;
end $$;
revoke all on function private.sync_auth_inventory_member() from public,anon,authenticated;
create trigger sync_inventory_member after insert or update of email,raw_app_meta_data,raw_user_meta_data,deleted_at,is_anonymous
on auth.users for each row execute function private.sync_auth_inventory_member();
create trigger disable_inventory_member after delete on auth.users
for each row execute function private.sync_auth_inventory_member();

-- Existing users receive a profile too. Preserve existing administrator roles.
insert into public.it_members(user_id,display_name,role,active)
select u.id,left(coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(u.email,''),u.id::text),100),
  case when u.raw_app_meta_data->>'inventory_role' in ('IT Admin','IT Officer') then u.raw_app_meta_data->>'inventory_role'
    else coalesce(m.role,'IT Officer') end,
  u.deleted_at is null and not coalesce(u.is_anonymous,false)
from auth.users u left join public.it_members m on m.user_id=u.id
on conflict(user_id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active,
  updated_at=now(),version=public.it_members.version+1;

create or replace function private.current_it_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.it_members m join auth.users u on u.id=m.user_id
  where auth.uid() is not null and m.user_id=auth.uid() and m.active
    and u.email_confirmed_at is not null and u.deleted_at is null
    and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<=now())
$$;

-- Remove the application's ability to create, promote or disable accounts.
-- Supabase Auth admin audit logs record administrator account actions.
create or replace function private.save_it_member(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Manage inventory accounts in Supabase Authentication' using errcode='42501';
end $$;
revoke all on function private.save_it_member(jsonb) from public,anon,authenticated;
comment on table public.it_members is 'Internal profiles mirrored automatically from administrator-managed Supabase Auth users. Historical identities survive Auth deletion. New accounts default to IT Officer. Public signup must remain disabled.';
