-- Older callers record a signed form by omitting signed_received. Preserve that contract.
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
end $$;
