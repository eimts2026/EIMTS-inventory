-- EIMTS Inventory: IT authorization, directory, asset register and custody history.
-- Apply only to project kmfuzygltjwhjwmwebbd. Inventory starts empty.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- New objects require explicit grants, including functions that Postgres normally
-- allows PUBLIC to execute. This project is dedicated to Inventory.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

create table public.it_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  role text not null check (role in ('IT Admin', 'IT Officer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
comment on table public.it_members is 'Explicit IT allowlist. Auth signup and user metadata never grant inventory access. Bootstrap the first admin through trusted SQL after verifying the Auth identity.';

-- SECURITY DEFINER is confined to private, fixed-search-path functions.
-- Read current membership from the database so disabling access takes effect on
-- the next request, without waiting for JWT claims to refresh.
create function private.current_it_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.it_members m
  join auth.users u on u.id = m.user_id
  where auth.uid() is not null and m.user_id = auth.uid() and m.active
    and not coalesce(u.is_anonymous, false)
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
$$;
revoke all on function private.current_it_role() from public, anon, authenticated;
grant execute on function private.current_it_role() to authenticated;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create unique index branches_name_unique on public.branches (lower(trim(name)));

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  name text not null check (length(trim(name)) between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create unique index locations_branch_name_unique on public.locations (branch_id, lower(trim(name)));

create table public.people (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null check (length(trim(employee_id)) between 1 and 100),
  name text not null check (length(trim(name)) between 1 and 100),
  department text not null check (length(trim(department)) between 1 and 100),
  location_id uuid not null references public.locations(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
create unique index people_employee_id_unique on public.people (lower(trim(employee_id)));
create index people_location_idx on public.people(location_id);
comment on table public.people is 'Employees who hold assets. These records carry no application access rights.';

create table public.workspace_settings (
  id boolean primary key default true check (id),
  organisation text not null check (length(trim(organisation)) between 1 and 100),
  verification_days integer not null check (verification_days between 1 and 365),
  paper_prefix text not null check (length(trim(paper_prefix)) between 1 and 20),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0)
);
-- Configuration only. No fictional inventory or IT accounts are inserted.
insert into public.workspace_settings(organisation, verification_days, paper_prefix)
values ('EIMTS', 90, 'HO');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  tag text not null check (length(trim(tag)) between 1 and 100),
  name text not null check (length(trim(name)) between 1 and 200),
  category text not null check (category in ('Laptop','Desktop','Monitor','Printer','Network','Other')),
  serial text check (serial is null or length(trim(serial)) between 1 and 100),
  status text not null default 'Available' check (status in ('Available','Assigned','Needs service','In repair','Retired')),
  location_id uuid not null references public.locations(id),
  condition text not null check (condition in ('Good','Fair','Damaged')),
  purchased_on date,
  warranty_until date,
  cost numeric(14,2) check (cost >= 0),
  next_verification_on date,
  last_verified_at timestamptz,
  retired_at timestamptz,
  retirement_note text check (length(retirement_note) <= 4000),
  created_by uuid not null references public.it_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  check (purchased_on is null or warranty_until is null or warranty_until >= purchased_on),
  check ((status = 'Retired') = (retired_at is not null)),
  check (status <> 'Available' or condition <> 'Damaged')
);
create unique index assets_tag_unique on public.assets(lower(trim(tag)));
create unique index assets_serial_unique on public.assets(lower(trim(serial))) where serial is not null;
create index assets_location_status_idx on public.assets(location_id, status);
create index assets_next_verification_idx on public.assets(next_verification_on) where status <> 'Retired';
create index assets_created_by_idx on public.assets(created_by);
comment on column public.assets.cost is 'LKR. NULL represents an unknown purchase cost.';
comment on column public.assets.serial is 'NULL represents an unknown serial. Known serials are unique after trimming and case folding.';

create table public.handovers (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  person_id uuid not null references public.people(id),
  location_id uuid not null references public.locations(id),
  issued_at timestamptz not null default now(),
  issued_by uuid not null references public.it_members(user_id),
  due_on date,
  issue_condition text not null check (issue_condition in ('Good','Fair')),
  accessories text not null default '' check (length(accessories) <= 4000),
  paper_reference text not null check (length(trim(paper_reference)) between 1 and 100),
  filing_location text not null default '' check (length(filing_location) <= 500),
  signed_received boolean not null default false,
  signed_received_at timestamptz,
  signed_received_by uuid references public.it_members(user_id),
  closed_at timestamptz,
  closed_by uuid references public.it_members(user_id),
  close_kind text check (close_kind in ('Return','Transfer')),
  return_condition text check (return_condition in ('Good','Fair','Damaged')),
  return_location_id uuid references public.locations(id),
  return_reference text check (length(return_reference) <= 100),
  return_filing text check (length(return_filing) <= 500),
  version integer not null default 1 check (version > 0),
  check (closed_at is null or closed_at >= issued_at),
  check (due_on is null or due_on >= (issued_at at time zone 'Asia/Colombo')::date),
  check ((signed_received and signed_received_at is not null and signed_received_by is not null)
      or (not signed_received and signed_received_at is null and signed_received_by is null)),
  check ((closed_at is null and closed_by is null and close_kind is null and return_condition is null and return_location_id is null)
      or (closed_at is not null and closed_by is not null and close_kind is not null and return_condition is not null and return_location_id is not null and coalesce(length(trim(return_reference)), 0) > 0))
);
-- This also protects against competing requests for the same device.
create unique index handovers_one_open_per_asset on public.handovers(asset_id) where closed_at is null;
create index handovers_asset_history_idx on public.handovers(asset_id, issued_at desc);
create index handovers_person_idx on public.handovers(person_id);
create index handovers_location_idx on public.handovers(location_id);
create index handovers_return_location_idx on public.handovers(return_location_id);
create index handovers_issued_by_idx on public.handovers(issued_by);
create index handovers_closed_by_idx on public.handovers(closed_by);
create index handovers_signed_received_by_idx on public.handovers(signed_received_by);
comment on table public.handovers is 'Immutable issue details with explicit return/transfer closure. Paper documents are physically filed.';

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid not null references public.it_members(user_id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb
);
create index activity_log_recent_idx on public.activity_log(occurred_at desc, id);
create index activity_log_entity_idx on public.activity_log(entity_type, entity_id);
create index activity_log_actor_idx on public.activity_log(actor_id);
comment on table public.activity_log is 'Database-written change history. Application roles have read access only.';

-- Receipts prevent a retried mutation from issuing or returning an asset twice.
create table private.command_receipts (
  request_id uuid primary key,
  actor_id uuid not null references public.it_members(user_id),
  action text not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index command_receipts_actor_idx on private.command_receipts(actor_id);
alter table private.command_receipts enable row level security;
revoke all on private.command_receipts from public, anon, authenticated;

-- All exposed tables have RLS. Writes will go through checked transactional RPCs.
do $$
declare t text;
begin
  foreach t in array array['it_members','branches','locations','people','workspace_settings','assets','handovers','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy it_members_read on public.it_members for select to authenticated
using ((select private.current_it_role()) = 'IT Admin' or (user_id = (select auth.uid()) and (select private.current_it_role()) is not null));
do $$
declare t text;
begin
  foreach t in array array['branches','locations','people','workspace_settings','assets','handovers','activity_log'] loop
    execute format('create policy it_read on public.%I for select to authenticated using ((select private.current_it_role()) is not null)', t);
  end loop;
end $$;

-- Trigger records before/after values using the authenticated actor. Clients
-- cannot supply an officer name or forge a separate activity entry.
create function private.record_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Command entry checks active membership. Keep attribution possible when an
  -- administrator disables their own membership in an authorized transaction.
  if auth.uid() is null or not exists (select 1 from public.it_members where user_id = auth.uid()) then
    raise exception 'An IT actor is required' using errcode = '42501';
  end if;
  insert into public.activity_log(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (auth.uid(), tg_op, tg_table_name,
    case when tg_table_name = 'it_members' then (to_jsonb(new)->>'user_id')::uuid
         when tg_table_name = 'workspace_settings' then null else (to_jsonb(new)->>'id')::uuid end,
    case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
revoke all on function private.record_change() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['it_members','branches','locations','people','workspace_settings','assets','handovers'] loop
    execute format('create trigger record_change after insert or update on public.%I for each row execute function private.record_change()', t);
  end loop;
end $$;

-- Keep custodian derived from the open handover, avoiding a second source of truth.
create view public.asset_register with (security_invoker = true) as
select a.*, h.id as active_handover_id, h.person_id as person_id, h.due_on
from public.assets a left join public.handovers h on h.asset_id = a.id and h.closed_at is null;
revoke all on public.asset_register from public, anon, authenticated;
grant select on public.asset_register to authenticated;
