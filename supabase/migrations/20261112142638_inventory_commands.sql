-- Transactional commands. The public entry point runs as the caller. Privileged
-- implementation lives in private and checks IT membership before any write.

create function private.require_it(p_admin boolean default false) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_role text := private.current_it_role();
begin
  if auth.uid() is null or v_role is null or (p_admin and v_role <> 'IT Admin') then
    raise exception 'Active IT membership with the required role is required' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create function private.require_location(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform l.id from public.locations l join public.branches b on b.id = l.branch_id
  where l.id = p_id and l.active and b.active for share of l, b;
  if not found then raise exception 'Choose an active location and branch' using errcode = '22023'; end if;
end $$;

-- Directory updates use versions. Disabling a record preserves historical links.
create function private.save_directory(p_kind text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_version integer := (p->>'version')::integer;
  v_result jsonb;
begin
  case p_kind
  when 'save_branch' then
    if v_version is null then
      insert into public.branches(id, name, active)
      values (v_id, trim(p->>'name'), coalesce((p->>'active')::boolean, true)) returning to_jsonb(branches.*) into v_result;
    else
      update public.branches set name = trim(p->>'name'), active = (p->>'active')::boolean,
        version = version + 1, updated_at = now()
      where id = v_id and version = v_version returning to_jsonb(branches.*) into v_result;
    end if;
  when 'save_location' then
    perform id from public.branches where id = (p->>'branch_id')::uuid and active for share;
    if not found then raise exception 'Choose an active branch' using errcode = '22023'; end if;
    if v_version is null then
      insert into public.locations(id, branch_id, name, active)
      values (v_id, (p->>'branch_id')::uuid, trim(p->>'name'), coalesce((p->>'active')::boolean, true)) returning to_jsonb(locations.*) into v_result;
    else
      update public.locations set branch_id = (p->>'branch_id')::uuid, name = trim(p->>'name'),
        active = (p->>'active')::boolean, version = version + 1, updated_at = now()
      where id = v_id and version = v_version returning to_jsonb(locations.*) into v_result;
    end if;
  when 'save_person' then
    perform private.require_location((p->>'location_id')::uuid);
    if v_version is null then
      insert into public.people(id, employee_id, name, department, location_id, active)
      values (v_id, trim(p->>'employee_id'), trim(p->>'name'), trim(p->>'department'),
        (p->>'location_id')::uuid, coalesce((p->>'active')::boolean, true)) returning to_jsonb(people.*) into v_result;
    else
      update public.people set employee_id = trim(p->>'employee_id'), name = trim(p->>'name'),
        department = trim(p->>'department'), location_id = (p->>'location_id')::uuid,
        active = (p->>'active')::boolean, version = version + 1, updated_at = now()
      where id = v_id and version = v_version returning to_jsonb(people.*) into v_result;
    end if;
  else raise exception 'Unknown directory command' using errcode = '22023';
  end case;
  if v_result is null then raise exception 'Record changed. Reload before saving' using errcode = '40001'; end if;
  return v_result;
end $$;

create function private.save_asset(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_version integer := (p->>'version')::integer;
  v_asset public.assets;
begin
  perform private.require_location((p->>'location_id')::uuid);
  if v_version is null then
    insert into public.assets(id, tag, name, category, serial, location_id, condition, status,
      purchased_on, warranty_until, cost, next_verification_on, created_by)
    values (v_id, trim(p->>'tag'), trim(p->>'name'), p->>'category', nullif(trim(p->>'serial'), ''),
      (p->>'location_id')::uuid, p->>'condition',
      case when p->>'condition' = 'Damaged' then 'Needs service' else 'Available' end,
      nullif(p->>'purchased_on','')::date, nullif(p->>'warranty_until','')::date,
      nullif(p->>'cost','')::numeric,
      nullif(p->>'next_verification_on','')::date, auth.uid()) returning * into v_asset;
  else
    select * into v_asset from public.assets where id = v_id for update;
    if not found or v_asset.version <> v_version then
      raise exception 'Asset changed. Reload before saving' using errcode = '40001';
    end if;
    -- Custody and service commands own these fields while the asset is issued.
    if v_asset.status = 'Retired' or
      (v_asset.status in ('Assigned','In repair') and
        (v_asset.location_id <> (p->>'location_id')::uuid or v_asset.condition <> p->>'condition')) then
      raise exception 'Use the custody or service workflow for this change' using errcode = '22023';
    end if;
    update public.assets set tag = trim(p->>'tag'), name = trim(p->>'name'), category = p->>'category',
      serial = nullif(trim(p->>'serial'),''), location_id = (p->>'location_id')::uuid,
      condition = p->>'condition', purchased_on = nullif(p->>'purchased_on','')::date,
      warranty_until = nullif(p->>'warranty_until','')::date, cost = nullif(p->>'cost','')::numeric,
      next_verification_on = nullif(p->>'next_verification_on','')::date,
      status = case when status = 'Available' and p->>'condition' = 'Damaged' then 'Needs service' else status end,
      version = version + 1, updated_at = now() where id = v_id returning * into v_asset;
  end if;
  return to_jsonb(v_asset);
end $$;

create function private.change_custody(p_action text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_asset public.assets;
  v_old public.handovers;
  v_new public.handovers;
  v_condition text := p->>'condition';
  v_signed boolean := coalesce((p->>'signed_received')::boolean, false);
begin
  -- Every custody operation locks the same asset row first. Competing issue,
  -- transfer, return and retirement requests serialize on that row.
  select * into v_asset from public.assets where id = (p->>'asset_id')::uuid for update;
  if not found or (p->>'asset_version')::integer is distinct from v_asset.version then
    raise exception 'Asset changed. Reload before continuing' using errcode = '40001';
  end if;
  perform private.require_location((p->>'location_id')::uuid);
  if v_condition is null or v_condition not in ('Good','Fair','Damaged') then
    raise exception 'Choose the observed condition' using errcode = '22023';
  end if;

  if p_action = 'issue_asset' then
    if v_asset.status <> 'Available' then
      raise exception 'Asset is unavailable for issue' using errcode = '22023';
    end if;
  else
    select * into v_old from public.handovers where asset_id = v_asset.id and closed_at is null for update;
    if not found or v_asset.status <> 'Assigned' or v_old.id is distinct from (p->>'handover_id')::uuid then
      raise exception 'The expected open handover was not found' using errcode = '22023';
    end if;
    if nullif(trim(p->>'return_reference'),'') is null then
      raise exception 'Enter the return or transfer paper reference' using errcode = '22023';
    end if;
    update public.handovers set closed_at = now(), closed_by = auth.uid(),
      close_kind = case when p_action = 'return_asset' then 'Return' else 'Transfer' end,
      return_condition = v_condition, return_location_id = (p->>'location_id')::uuid,
      return_reference = trim(p->>'return_reference'), return_filing = coalesce(p->>'return_filing',''),
      version = version + 1 where id = v_old.id;
  end if;

  if p_action = 'return_asset' then
    update public.assets set status = case when v_condition = 'Damaged' then 'Needs service' else 'Available' end,
      condition = v_condition, location_id = (p->>'location_id')::uuid, version = version + 1,
      updated_at = now() where id = v_asset.id;
    return jsonb_build_object('asset_id', v_asset.id, 'handover_id', v_old.id);
  end if;

  if v_condition = 'Damaged' then
    raise exception 'Damaged assets must be returned for service' using errcode = '22023';
  end if;
  perform id from public.people where id = (p->>'person_id')::uuid and active for share;
  if not found then raise exception 'Choose an active employee' using errcode = '22023'; end if;
  if p_action = 'transfer_asset' and v_old.person_id = (p->>'person_id')::uuid then
    raise exception 'Choose a different custodian' using errcode = '22023';
  end if;
  insert into public.handovers(asset_id, person_id, location_id, issued_by, due_on, issue_condition,
    accessories, paper_reference, filing_location, signed_received, signed_received_at, signed_received_by)
  values (v_asset.id, (p->>'person_id')::uuid, (p->>'location_id')::uuid, auth.uid(),
    nullif(p->>'due_on','')::date, v_condition, coalesce(p->>'accessories',''), trim(p->>'paper_reference'),
    coalesce(p->>'filing_location',''), v_signed, case when v_signed then now() end,
    case when v_signed then auth.uid() end) returning * into v_new;
  update public.assets set status = 'Assigned', condition = v_condition,
    location_id = (p->>'location_id')::uuid, version = version + 1, updated_at = now() where id = v_asset.id;
  return to_jsonb(v_new);
end $$;

create function private.save_it_member(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := (p->>'user_id')::uuid;
  v_old public.it_members;
  v_new public.it_members;
begin
  -- Serialize membership changes to protect the final active administrator.
  perform pg_advisory_xact_lock(730121112);
  perform private.require_it(true);
  perform id from auth.users where id = v_id and deleted_at is null and not coalesce(is_anonymous, false);
  if not found then raise exception 'A verified existing Auth identity is required' using errcode = '22023'; end if;
  select * into v_old from public.it_members where user_id = v_id for update;
  if found then
    if (p->>'version')::integer is distinct from v_old.version then
      raise exception 'Membership changed. Reload before saving' using errcode = '40001';
    end if;
    if v_old.active and v_old.role = 'IT Admin' and
      (not (p->>'active')::boolean or p->>'role' <> 'IT Admin') and not exists (
        select 1 from public.it_members where user_id <> v_id and active and role = 'IT Admin'
      ) then raise exception 'Keep at least one active IT administrator' using errcode = '22023'; end if;
    update public.it_members set display_name = trim(p->>'display_name'), role = p->>'role',
      active = (p->>'active')::boolean, version = version + 1, updated_at = now()
    where user_id = v_id returning * into v_new;
  else
    if p ? 'version' then raise exception 'Membership no longer exists' using errcode = '40001'; end if;
    insert into public.it_members(user_id, display_name, role, active)
    values (v_id, trim(p->>'display_name'), p->>'role', coalesce((p->>'active')::boolean, true)) returning * into v_new;
  end if;
  return to_jsonb(v_new);
end $$;

create function private.execute_inventory_command(p_request_id uuid, p_action text, p_data jsonb) returns jsonb
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
    update public.handovers set signed_received = true, signed_received_at = now(), signed_received_by = v_actor,
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

-- Internal helpers have no client grants. Only the checked dispatcher is callable.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_it_role() to authenticated;
grant execute on function private.execute_inventory_command(uuid, text, jsonb) to authenticated;

create function public.inventory_command(p_request_id uuid, p_action text, p_data jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.execute_inventory_command(p_request_id, p_action, p_data)
$$;
revoke all on function public.inventory_command(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.inventory_command(uuid, text, jsonb) to authenticated;
comment on function public.inventory_command(uuid, text, jsonb) is 'IT-only transactional writes. Reuse a request UUID only when retrying identical data. Supply current row versions for edits.';
