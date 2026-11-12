-- Physical verification keeps expected inventory separate from observed facts.
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  location_id uuid not null references public.locations(id),
  due_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.it_members(user_id),
  closed_at timestamptz,
  closed_by uuid references public.it_members(user_id),
  version integer not null default 1,
  check ((closed_at is null) = (closed_by is null))
);
create index audits_location_idx on public.audits(location_id);
create index audits_created_by_idx on public.audits(created_by);
create index audits_closed_by_idx on public.audits(closed_by);

create table public.audit_items (
  audit_id uuid not null references public.audits(id),
  asset_id uuid not null references public.assets(id),
  expected_location_id uuid not null references public.locations(id),
  expected_person_id uuid references public.people(id),
  expected_tag text not null,
  expected_serial text,
  expected_condition text not null,
  primary key(audit_id, asset_id)
);
create index audit_items_asset_idx on public.audit_items(asset_id);
create index audit_items_location_idx on public.audit_items(expected_location_id);
create index audit_items_person_idx on public.audit_items(expected_person_id);
comment on table public.audit_items is 'Frozen expected register at audit start. Future custody or metadata edits cannot rewrite this snapshot.';

create table public.observations (
  audit_id uuid not null references public.audits(id),
  asset_id uuid not null references public.assets(id),
  observed_location_id uuid not null references public.locations(id),
  condition text not null check (condition in ('Good','Fair','Damaged')),
  confirmed_serial text,
  note text not null default '' check (length(note) <= 4000),
  verified_at timestamptz not null default now(),
  verified_by uuid not null references public.it_members(user_id),
  primary key(audit_id, asset_id)
);
create index observations_asset_idx on public.observations(asset_id);
create index observations_location_idx on public.observations(observed_location_id);
create index observations_verifier_idx on public.observations(verified_by);

create table public.discrepancies (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  audit_id uuid references public.audits(id),
  title text not null check (length(trim(title)) between 1 and 200),
  type text not null check (type in ('Location mismatch','Damage','Not seen','Custody mismatch','Other')),
  owner_id uuid not null references public.it_members(user_id),
  due_on date not null,
  status text not null default 'Open' check (status in ('Open','Resolved')),
  note text not null default '' check (length(note) <= 4000),
  expected_location_id uuid not null references public.locations(id),
  observed_location_id uuid references public.locations(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.it_members(user_id),
  resolved_at timestamptz,
  resolved_by uuid references public.it_members(user_id),
  resolution text check (length(resolution) <= 4000),
  version integer not null default 1,
  check ((status = 'Resolved') = (resolved_at is not null and resolved_by is not null and length(trim(resolution)) > 0))
);
create unique index discrepancies_audit_asset_type_unique on public.discrepancies(audit_id, asset_id, type) where audit_id is not null;
create index discrepancies_asset_idx on public.discrepancies(asset_id);
create index discrepancies_audit_idx on public.discrepancies(audit_id);
create index discrepancies_owner_idx on public.discrepancies(owner_id);
create index discrepancies_created_by_idx on public.discrepancies(created_by);
create index discrepancies_resolved_by_idx on public.discrepancies(resolved_by);
create index discrepancies_expected_location_idx on public.discrepancies(expected_location_id);
create index discrepancies_observed_location_idx on public.discrepancies(observed_location_id);

do $$ declare t text; begin
  foreach t in array array['audits','audit_items','observations','discrepancies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy it_read on public.%I for select to authenticated using ((select private.current_it_role()) is not null)', t);
  end loop;
  foreach t in array array['audits','discrepancies'] loop
    execute format('create trigger record_change after insert or update on public.%I for each row execute function private.record_change()', t);
  end loop;
end $$;


create function private.verification_command(p_action text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  a public.audits;
  v_asset public.assets;
  v_item public.audit_items;
  d public.discrepancies;
  v_id uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_result jsonb;
  v_location uuid := (p->>'observed_location_id')::uuid;
  v_expected uuid;
  v_today date := (now() at time zone 'Asia/Colombo')::date;
begin
  case p_action
  when 'start_audit' then
    perform private.require_location((p->>'location_id')::uuid);
    if (p->>'due_on')::date < v_today then raise exception 'Due date must be today or later' using errcode='22023'; end if;
    -- Freeze assets and current handovers in one statement snapshot.
    insert into public.audits(id,name,location_id,due_on,created_by)
    values(v_id,trim(p->>'name'),(p->>'location_id')::uuid,(p->>'due_on')::date,auth.uid()) returning * into a;
    insert into public.audit_items(audit_id,asset_id,expected_location_id,expected_person_id,expected_tag,expected_serial,expected_condition)
    select a.id, r.id, r.location_id, r.person_id, r.tag, r.serial, r.condition
    from public.asset_register r where r.location_id=a.location_id and r.status <> 'Retired';
    if not found then raise exception 'This location has no active assets' using errcode='22023'; end if;
    return to_jsonb(a);
  when 'record_observation', 'close_audit' then
    -- Audit row serializes checks against closure. Repeated close is harmless.
    select * into a from public.audits where id=(p->>'audit_id')::uuid for update;
    if not found then raise exception 'Audit not found' using errcode='22023'; end if;
    if p_action='close_audit' and a.closed_at is not null then return to_jsonb(a); end if;
    if a.closed_at is not null then raise exception 'Audit is closed' using errcode='22023'; end if;
    if p_action='close_audit' then
      insert into public.discrepancies(asset_id,audit_id,title,type,owner_id,due_on,note,expected_location_id,created_by)
      select i.asset_id,a.id,'Asset unseen when verification closed','Not seen',auth.uid(),v_today+7,
        'Follow up on the physical device and recorded custodian.',i.expected_location_id,auth.uid()
      from public.audit_items i where i.audit_id=a.id and not exists
        (select 1 from public.observations o where o.audit_id=a.id and o.asset_id=i.asset_id)
      on conflict (audit_id,asset_id,type) where audit_id is not null do nothing;
      update public.audits set closed_at=now(),closed_by=auth.uid(),version=version+1 where id=a.id returning to_jsonb(audits.*) into v_result;
      return v_result;
    end if;
    select * into v_asset from public.assets where id=(p->>'asset_id')::uuid for update;
    if not found or v_asset.status='Retired' then raise exception 'Choose an active asset' using errcode='22023'; end if;
    select * into v_item from public.audit_items where audit_id=a.id and asset_id=v_asset.id;
    v_expected := coalesce(v_item.expected_location_id,v_asset.location_id);
    perform private.require_location(v_location);
    if nullif(lower(trim(p->>'confirmed_serial')),'') is distinct from lower(coalesce(v_item.expected_serial,v_asset.serial)) then
      raise exception 'Physical serial does not match the register snapshot' using errcode='22023';
    end if;
    if coalesce(v_item.expected_serial,v_asset.serial) is null and nullif(trim(p->>'note'),'') is null then
      raise exception 'Record how the device was identified when its serial is unknown' using errcode='22023';
    end if;
    insert into public.observations(audit_id,asset_id,observed_location_id,condition,confirmed_serial,note,verified_by)
    values(a.id,v_asset.id,v_location,p->>'condition',nullif(trim(p->>'confirmed_serial'),''),coalesce(p->>'note',''),auth.uid()) returning to_jsonb(observations.*) into v_result;
    update public.assets set condition=p->>'condition',last_verified_at=now(),
      next_verification_on=v_today+(select verification_days from public.workspace_settings where id),
      status=case when status='Available' and p->>'condition'='Damaged' then 'Needs service' else status end,
      version=version+1,updated_at=now() where id=v_asset.id;
    if v_expected<>v_location or v_item.asset_id is null then
      insert into public.discrepancies(asset_id,audit_id,title,type,owner_id,due_on,note,expected_location_id,observed_location_id,created_by)
      values(v_asset.id,a.id,'Observed location differs from the audit record','Location mismatch',auth.uid(),v_today+7,coalesce(p->>'note',''),v_expected,v_location,auth.uid());
    end if;
    if p->>'condition'='Damaged' then
      insert into public.discrepancies(asset_id,audit_id,title,type,owner_id,due_on,note,expected_location_id,observed_location_id,created_by)
      values(v_asset.id,a.id,'Damage found during verification','Damage',auth.uid(),v_today+7,coalesce(p->>'note',''),v_expected,v_location,auth.uid());
    end if;
    update public.audits set version=version+1 where id=a.id;
    return v_result;
  when 'raise_discrepancy' then
    select * into v_asset from public.assets where id=(p->>'asset_id')::uuid for share;
    if not found then raise exception 'Asset not found' using errcode='22023'; end if;
    if v_location is not null then perform private.require_location(v_location); end if;
    if not exists(select 1 from public.it_members where user_id=(p->>'owner_id')::uuid and active) then
      raise exception 'Choose an active IT case owner' using errcode='22023';
    end if;
    insert into public.discrepancies(id,asset_id,title,type,owner_id,due_on,note,expected_location_id,observed_location_id,created_by)
    values(v_id,v_asset.id,trim(p->>'title'),p->>'type',(p->>'owner_id')::uuid,(p->>'due_on')::date,
      coalesce(p->>'note',''),v_asset.location_id,v_location,auth.uid()) returning to_jsonb(discrepancies.*) into v_result;
    return v_result;
  when 'resolve_discrepancy' then
    select * into d from public.discrepancies where id=(p->>'id')::uuid for update;
    if not found or d.version is distinct from (p->>'version')::integer then raise exception 'Case changed. Reload before saving' using errcode='40001'; end if;
    if d.status='Resolved' or nullif(trim(p->>'resolution'),'') is null then raise exception 'Record the resolution of an open case' using errcode='22023'; end if;
    if coalesce((p->>'apply_location')::boolean,false) then
      perform private.require_location(d.observed_location_id);
      select * into v_asset from public.assets where id=d.asset_id for update;
      if v_asset.version is distinct from (p->>'asset_version')::integer then raise exception 'Asset changed. Reload before correcting its location' using errcode='40001'; end if;
      if v_asset.status='Retired' then raise exception 'Retired asset location cannot be changed' using errcode='22023'; end if;
      update public.assets set location_id=d.observed_location_id,version=version+1,updated_at=now() where id=d.asset_id;
    end if;
    update public.discrepancies set status='Resolved',resolved_at=now(),resolved_by=auth.uid(),
      resolution=trim(p->>'resolution'),version=version+1 where id=d.id returning to_jsonb(discrepancies.*) into v_result;
    return v_result;
  else raise exception 'Unknown verification command' using errcode='22023';
  end case;
end $$;
revoke all on function private.verification_command(text,jsonb) from public,anon,authenticated;

-- CSV imports are one transaction. A bad row rolls back the entire batch.
create function private.import_assets(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; count integer := 0;
begin
  if jsonb_typeof(p->'assets') is distinct from 'array' or jsonb_array_length(p->'assets') not between 1 and 10000 then
    raise exception 'Import between 1 and 10000 assets' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p->'assets') loop
    if item ? 'version' then raise exception 'Imports create new assets only' using errcode='22023'; end if;
    perform private.save_asset(item);
    count := count + 1;
  end loop;
  return jsonb_build_object('imported', count);
end $$;
revoke all on function private.import_assets(jsonb) from public,anon,authenticated;

-- Extend the checked dispatcher while retaining request receipts and old commands.
create or replace function private.execute_inventory_command(p_request_id uuid, p_action text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_receipt private.command_receipts;
  v_result jsonb;
  v_asset public.assets;
begin
  v_actor := private.require_it();
  if p_request_id is null or p_action is null or jsonb_typeof(p_data) is distinct from 'object' then
    raise exception 'A request ID, command and data object are required' using errcode = '22023';
  end if;
  -- Reusing an ID with different data is an error. Failed transactions leave
  -- neither a receipt nor partial writes. Retries return the original result.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_receipt from private.command_receipts where request_id = p_request_id;
  if found then
    if v_receipt.actor_id <> v_actor or v_receipt.action <> p_action or v_receipt.payload <> p_data then
      raise exception 'Request ID was already used with different data' using errcode = '22023';
    end if;
    return v_receipt.result;
  end if;

  case p_action
  when 'save_branch', 'save_location', 'save_person' then
    v_result := private.save_directory(p_action, p_data);
  when 'start_audit', 'record_observation', 'close_audit', 'raise_discrepancy', 'resolve_discrepancy' then
    v_result := private.verification_command(p_action, p_data);
  when 'import_assets' then
    v_result := private.import_assets(p_data);
  when 'save_asset' then v_result := private.save_asset(p_data);
  when 'issue_asset', 'transfer_asset', 'return_asset' then
    v_result := private.change_custody(p_action, p_data);
  when 'save_it_member' then v_result := private.save_it_member(p_data);
  when 'save_settings' then
    perform private.require_it(true);
    update public.workspace_settings set organisation = trim(p_data->>'organisation'),
      verification_days = (p_data->>'verification_days')::integer, paper_prefix = trim(p_data->>'paper_prefix'),
      version = version + 1, updated_at = now()
    where id and version = (p_data->>'version')::integer returning to_jsonb(workspace_settings.*) into v_result;
    if not found then raise exception 'Settings changed. Reload before saving' using errcode = '40001'; end if;
  when 'retire_asset' then
    select * into v_asset from public.assets where id = (p_data->>'asset_id')::uuid for update;
    if not found or v_asset.version is distinct from (p_data->>'asset_version')::integer then
      raise exception 'Asset changed. Reload before continuing' using errcode = '40001';
    end if;
    if v_asset.status not in ('Available','Needs service') or nullif(trim(p_data->>'note'),'') is null then
      raise exception 'Return the asset and record a retirement reason' using errcode = '22023';
    end if;
    update public.assets set status = 'Retired', retired_at = now(), retirement_note = trim(p_data->>'note'),
      version = version + 1, updated_at = now() where id = v_asset.id returning to_jsonb(assets.*) into v_result;
  when 'record_signed_form' then
    update public.handovers set signed_received = (p_data->>'signed_received')::boolean,
      signed_received_at = case when (p_data->>'signed_received')::boolean then now() end,
      signed_received_by = case when (p_data->>'signed_received')::boolean then v_actor end,
      paper_reference = coalesce(nullif(trim(p_data->>'paper_reference'),''), paper_reference),
      filing_location = p_data->>'filing_location', version = version + 1
    where id = (p_data->>'handover_id')::uuid and version = (p_data->>'version')::integer
    returning to_jsonb(handovers.*) into v_result;
    if not found then raise exception 'Handover changed. Reload before saving' using errcode = '40001'; end if;
  else raise exception 'Unknown inventory command' using errcode = '22023';
  end case;

  insert into private.command_receipts(request_id, actor_id, action, payload, result)
  values (p_request_id, v_actor, p_action, p_data, v_result);
  return v_result;
end $$;

-- Officers need IT display names for attribution and case ownership. Employee
-- custodians remain in a separate table and gain no login permissions.
drop policy it_members_read on public.it_members;
create policy it_members_read on public.it_members for select to authenticated
using ((select private.current_it_role()) is not null);

-- One statement snapshot avoids mixing data from different commits while loading.
-- SECURITY INVOKER preserves the same grants and RLS as direct table reads.
create function public.inventory_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(m) from public.it_members m),'[]'::jsonb),
    'branches', coalesce((select jsonb_agg(b) from public.branches b),'[]'::jsonb),
    'locations', coalesce((select jsonb_agg(l) from public.locations l),'[]'::jsonb),
    'people', coalesce((select jsonb_agg(p) from public.people p),'[]'::jsonb),
    'assets', coalesce((select jsonb_agg(a order by a.created_at desc) from public.asset_register a),'[]'::jsonb),
    'handovers', coalesce((select jsonb_agg(h order by h.issued_at desc) from public.handovers h),'[]'::jsonb),
    'audits', coalesce((select jsonb_agg(a order by a.created_at desc) from public.audits a),'[]'::jsonb),
    'items', coalesce((select jsonb_agg(i) from public.audit_items i),'[]'::jsonb),
    'observations', coalesce((select jsonb_agg(o) from public.observations o),'[]'::jsonb),
    'issues', coalesce((select jsonb_agg(d order by d.created_at desc) from public.discrepancies d),'[]'::jsonb),
    'activity', coalesce((select jsonb_agg(e order by e.occurred_at desc) from
      (select * from public.activity_log order by occurred_at desc,id desc limit 1000) e),'[]'::jsonb),
    'settings', (select to_jsonb(s) from public.workspace_settings s where id)
  )
$$;
revoke all on function public.inventory_snapshot() from public,anon,authenticated;
grant execute on function public.inventory_snapshot() to authenticated;
