-- Retain historical identities while allowing Supabase Auth account deletion.
alter table public.it_members drop constraint if exists it_members_user_id_fkey;
drop trigger if exists record_change on public.it_members;
create or replace function private.disable_deleted_auth_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.it_members set active=false,updated_at=now(),version=version+1 where user_id=old.id;
  return old;
end $$;
revoke all on function private.disable_deleted_auth_member() from public,anon,authenticated;
create trigger disable_deleted_auth_member after delete on auth.users
for each row execute function private.disable_deleted_auth_member();
create or replace function private.save_it_member(p jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  raise exception 'Manage accounts in Supabase Authentication' using errcode='42501';
end $$;
