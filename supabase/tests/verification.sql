-- Run after the initial IT administrator has been provisioned.
-- Every directory, inventory, audit and activity change is rolled back.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'role','authenticated')::text,true)
from public.it_members where active and role='IT Admin' order by created_at limit 1;
set local role authenticated;
do $$
<<verification>>
declare
  room uuid := gen_random_uuid(); other_room uuid := gen_random_uuid();
  first_asset uuid := gen_random_uuid(); second_asset uuid := gen_random_uuid(); missing_asset uuid := gen_random_uuid();
  audit_id uuid := gen_random_uuid(); req uuid := gen_random_uuid();
  data jsonb; result jsonb; case_id uuid; asset_version integer;
begin
  perform public.inventory_command(gen_random_uuid(),'save_location',jsonb_build_object('id',room,'name','Verification test room','branch_name','Verification tests'));
  perform public.inventory_command(gen_random_uuid(),'save_location',jsonb_build_object('id',other_room,'name','Second test room','branch_name','Verification tests'));
  begin
    perform public.inventory_command(gen_random_uuid(),'start_audit',jsonb_build_object('name','Empty test','location_id',room,'due_on',current_date+7));
    raise exception 'Empty audit was accepted';
  exception when invalid_parameter_value then null; end;
  perform public.inventory_command(gen_random_uuid(),'save_asset',jsonb_build_object('id',first_asset,'tag',first_asset,'name','Known serial','serial','ORIGINAL','category','Laptop','condition','Good','location_id',room));
  perform public.inventory_command(gen_random_uuid(),'save_asset',jsonb_build_object('id',second_asset,'tag',second_asset,'name','Unknown serial','category','Laptop','condition','Good','location_id',room));
  perform public.inventory_command(gen_random_uuid(),'save_asset',jsonb_build_object('id',missing_asset,'tag',missing_asset,'name','Missing device','category','Laptop','condition','Good','location_id',room));
  perform public.inventory_command(gen_random_uuid(),'start_audit',jsonb_build_object('id',audit_id,'name','Frozen snapshot test','location_id',room,'due_on',current_date+7));
  if (select count(*) from public.audit_items i where i.audit_id=verification.audit_id) <> 3 then raise exception 'Snapshot incomplete'; end if;
  perform public.inventory_command(gen_random_uuid(),'save_asset',jsonb_build_object('id',first_asset,'version',1,'tag',first_asset,'name','Known serial','serial','CHANGED','category','Laptop','condition','Good','location_id',other_room));
  if not exists(select 1 from public.audit_items i where i.audit_id=verification.audit_id and i.asset_id=first_asset and i.expected_serial='ORIGINAL' and i.expected_location_id=room) then raise exception 'Expected evidence changed'; end if;
  data:=jsonb_build_object('audit_id',audit_id,'asset_id',first_asset,'observed_location_id',other_room,'condition','Damaged','confirmed_serial','WRONG');
  begin
    perform public.inventory_command(gen_random_uuid(),'record_observation',data);
    raise exception 'Wrong physical serial was accepted';
  exception when invalid_parameter_value then null; end;
  data:=data||'{"confirmed_serial":"ORIGINAL"}';
  result:=public.inventory_command(req,'record_observation',data);
  if public.inventory_command(req,'record_observation',data)<>result then raise exception 'Observation retry differs'; end if;
  if (select count(*) from public.discrepancies d where d.audit_id=verification.audit_id and d.asset_id=first_asset)<>2 then raise exception 'Mismatch and damage must each create a case'; end if;
  if not exists(select 1 from public.assets where id=first_asset and status='Needs service') then raise exception 'Damage did not block issue'; end if;
  -- A serial learned after the audit began must not replace its unknown snapshot.
  perform public.inventory_command(gen_random_uuid(),'save_asset',jsonb_build_object('id',second_asset,'version',1,'tag',second_asset,'name','Unknown serial','serial','LEARNED-LATER','category','Laptop','condition','Good','location_id',room));
  data:=jsonb_build_object('audit_id',audit_id,'asset_id',second_asset,'observed_location_id',room,'condition','Good');
  begin
    perform public.inventory_command(gen_random_uuid(),'record_observation',data);
    raise exception 'Unknown serial accepted without identification evidence';
  exception when invalid_parameter_value then null; end;
  perform public.inventory_command(gen_random_uuid(),'record_observation',data||'{"note":"Identified by permanent asset label and model."}');
  perform public.inventory_command(gen_random_uuid(),'close_audit',jsonb_build_object('audit_id',audit_id));
  perform public.inventory_command(gen_random_uuid(),'close_audit',jsonb_build_object('audit_id',audit_id));
  if (select count(*) from public.discrepancies d where d.audit_id=verification.audit_id and d.type='Not seen')<>1 then raise exception 'Audit closure duplicated missing case'; end if;
  begin
    perform public.inventory_command(gen_random_uuid(),'record_observation',data);
    raise exception 'Closed audit accepted an observation';
  exception when invalid_parameter_value then null; end;
  select id into case_id from public.discrepancies d where d.audit_id=verification.audit_id and d.asset_id=first_asset and type='Location mismatch';
  select version into asset_version from public.assets where id=first_asset;
  begin
    perform public.inventory_command(gen_random_uuid(),'resolve_discrepancy',jsonb_build_object('id',case_id,'version',1,'resolution','Confirmed paper movement','apply_location',true,'asset_version',1));
    raise exception 'Stale location correction was accepted';
  exception when serialization_failure then null; end;
  perform public.inventory_command(gen_random_uuid(),'resolve_discrepancy',jsonb_build_object('id',case_id,'version',1,'resolution','Confirmed paper movement','apply_location',true,'asset_version',asset_version));
  if not exists(select 1 from public.discrepancies where id=case_id and status='Resolved' and resolved_by=auth.uid()) then raise exception 'Resolution attribution missing'; end if;
  result:=public.inventory_snapshot();
  if jsonb_array_length(result->'audits')=0 then raise exception 'Server snapshot omitted audits'; end if;
  begin
    update public.audit_items set expected_serial='FORGED' where audit_items.audit_id=verification.audit_id;
    raise exception 'Client rewrote audit evidence';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Snapshot, serial confirmation, damage, retries, audit closure, resolution and evidence protection checks passed. Fixtures rolled back.' as result;
