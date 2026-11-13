-- Historical identities survive removal of access profiles and Auth accounts.
create table private.inventory_identities(user_id uuid primary key,display_name text not null);
insert into private.inventory_identities select user_id,display_name from public.it_members;
revoke all on private.inventory_identities from public,anon,authenticated;
alter table private.inventory_identities enable row level security;
do $$ declare r record; begin
for r in select conrelid::regclass as tbl,conname,pg_get_constraintdef(oid) as def from pg_constraint where confrelid='public.it_members'::regclass loop
execute format('alter table %s drop constraint %I',r.tbl,r.conname);
execute format('alter table %s add constraint %I %s',r.tbl,r.conname,replace(r.def,'REFERENCES it_members(user_id)','REFERENCES private.inventory_identities(user_id)'));
end loop; end $$;
-- Capture identities for future memberships before inventory writes reference them.
create function private.retain_inventory_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into private.inventory_identities values(new.user_id,new.display_name) on conflict(user_id) do update set display_name=excluded.display_name; return new; end $$;
revoke all on function private.retain_inventory_identity() from public,anon,authenticated;
create trigger retain_inventory_identity after insert or update of display_name on public.it_members for each row execute function private.retain_inventory_identity();
