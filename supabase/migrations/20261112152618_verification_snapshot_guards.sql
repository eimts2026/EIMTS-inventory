-- Freeze unknown serials too. A later register edit must not rewrite audit evidence.
create or replace function private.verification_command(p_action text, p jsonb) returns jsonb
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
  v_serial text;
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
    v_serial := case when v_item.asset_id is not null then v_item.expected_serial else v_asset.serial end;
    if nullif(lower(trim(p->>'confirmed_serial')),'') is distinct from lower(v_serial) then
      raise exception 'Physical serial does not match the register snapshot' using errcode='22023';
    end if;
    if v_serial is null and nullif(trim(p->>'note'),'') is null then
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

-- Permit a recorded location transfer with the same custodian.
create or replace function private.change_custody(p_action text, p jsonb) returns jsonb
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
  if p_action = 'transfer_asset' and v_old.person_id = (p->>'person_id')::uuid and v_asset.location_id = (p->>'location_id')::uuid then
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
