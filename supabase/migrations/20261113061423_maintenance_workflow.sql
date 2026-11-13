-- Repairs use the same IT authorization, audit trail and request receipts as custody.
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id),
  problem text not null check (length(trim(problem)) between 1 and 200),
  vendor text not null check (length(trim(vendor)) between 1 and 100),
  opened_at timestamptz not null default now(),
  opened_by uuid not null references private.inventory_identities(user_id),
  due_on date not null,
  paper_reference text not null default '' check (length(paper_reference)<=80),
  closed_at timestamptz,
  closed_by uuid references private.inventory_identities(user_id),
  cost numeric(14,2) not null default 0 check (cost>=0 and cost<1000000000000),
  resolution text not null default '' check (length(resolution)<=500),
  version integer not null default 1 check (version>0),
  check ((closed_at is null and closed_by is null and resolution='' and cost=0)
    or (closed_at is not null and closed_by is not null and length(trim(resolution))>0))
);
create unique index repairs_one_open_per_asset on public.repairs(asset_id) where closed_at is null;
create index repairs_due_open on public.repairs(due_on) where closed_at is null;
create index repairs_opened_by on public.repairs(opened_by);
create index repairs_closed_by on public.repairs(closed_by);
alter table public.repairs enable row level security;
revoke all on public.repairs from public,anon,authenticated;
grant select on public.repairs to authenticated;
create policy repairs_read on public.repairs for select to authenticated
using ((select private.current_it_role()) is not null);
create trigger record_change after insert or update on public.repairs
for each row execute function private.record_change();

create function private.maintenance_command(p_action text,p jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  a public.assets;
  r public.repairs;
  v_cost numeric;
begin
  perform private.require_it();
  -- Always lock the asset first, matching custody and retirement lock order.
  select * into a from public.assets where id=(p->>'asset_id')::uuid for update;
  if not found or a.version is distinct from (p->>'asset_version')::integer then
    raise exception 'Asset changed. Reload before continuing' using errcode='40001';
  end if;
  if p_action='open_repair' then
    if a.status not in ('Available','Needs service') or exists (
      select 1 from public.handovers where asset_id=a.id and closed_at is null
    ) then raise exception 'Return assigned devices before logging a repair' using errcode='22023'; end if;
    if nullif(trim(p->>'problem'),'') is null or nullif(trim(p->>'vendor'),'') is null
      or (p->>'due_on')::date is null or (p->>'due_on')::date < (now() at time zone 'Asia/Colombo')::date then
      raise exception 'Enter the fault, service provider and a current or future due date' using errcode='22023';
    end if;
    insert into public.repairs(asset_id,problem,vendor,due_on,paper_reference,opened_by)
    values(a.id,trim(p->>'problem'),trim(p->>'vendor'),(p->>'due_on')::date,
      coalesce(trim(p->>'paper_reference'),''),auth.uid()) returning * into r;
    update public.assets set status='In repair',version=version+1,updated_at=now() where id=a.id;
  elsif p_action='complete_repair' then
    select * into r from public.repairs where id=(p->>'repair_id')::uuid and asset_id=a.id for update;
    if not found or r.version is distinct from (p->>'version')::integer then
      raise exception 'Repair changed. Reload before continuing' using errcode='40001';
    end if;
    if r.closed_at is not null or a.status<>'In repair' then
      raise exception 'This repair is no longer open' using errcode='22023';
    end if;
    v_cost := (p->>'cost')::numeric;
    if nullif(trim(p->>'resolution'),'') is null or v_cost is null or v_cost<0
      or v_cost>=1000000000000 or v_cost<>round(v_cost,2)
      or (p->>'ready_for_stock')::boolean is distinct from true then
      raise exception 'Record the outcome, valid cost and confirm the device is ready for stock' using errcode='22023';
    end if;
    update public.repairs set closed_at=now(),closed_by=auth.uid(),cost=v_cost,
      resolution=trim(p->>'resolution'),version=version+1 where id=r.id returning * into r;
    -- Completion is explicitly a checked, successful return to usable IT stock.
    update public.assets set status='Available',condition='Good',version=version+1,updated_at=now() where id=a.id;
  else raise exception 'Unknown maintenance command' using errcode='22023';
  end if;
  return to_jsonb(r);
end $$;
revoke all on function private.maintenance_command(text,jsonb) from public,anon,authenticated;

-- Explicit definitions preserve the inspected live commands and snapshot.
CREATE OR REPLACE FUNCTION private.execute_inventory_command(p_request_id uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  when 'open_repair', 'complete_repair' then
    v_result := private.maintenance_command(p_action,p_data);
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
    update public.handovers set signed_received = coalesce((p_data->>'signed_received')::boolean, true),
      signed_received_at = case when coalesce((p_data->>'signed_received')::boolean, true) then now() end,
      signed_received_by = case when coalesce((p_data->>'signed_received')::boolean, true) then v_actor end,
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
end $function$
;
CREATE OR REPLACE FUNCTION public.inventory_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
    'repairs', coalesce((select jsonb_agg(r order by r.opened_at desc,r.id) from public.repairs r),'[]'::jsonb),
    'settings', (select to_jsonb(s) from public.workspace_settings s where id)
  )
$function$
;
comment on table public.repairs is 'IT-only repair history. Open and complete using inventory_command. Paper documents remain physically filed.';
