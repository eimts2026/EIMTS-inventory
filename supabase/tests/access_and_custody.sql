-- Run against a development Inventory database using trusted SQL access.
-- All temporary identities and inventory records are rolled back.
begin;
create temporary table fixture (admin_id uuid, officer_id uuid, outsider_id uuid, branch_id uuid, location_id uuid, person_id uuid, second_person_id uuid, asset_id uuid, handover_id uuid);
insert into fixture values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), null);
grant select, update on fixture to authenticated;

insert into auth.users(id, email, aud, role, is_anonymous)
select admin_id, admin_id::text || '@inventory-test.invalid', 'authenticated', 'authenticated', false from fixture
union all select officer_id, officer_id::text || '@inventory-test.invalid', 'authenticated', 'authenticated', false from fixture
union all select outsider_id, outsider_id::text || '@inventory-test.invalid', 'authenticated', 'authenticated', false from fixture;

-- Bootstrap is a trusted operation. The application cannot grant itself access.
select set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role', 'authenticated')::text, true) from fixture;
insert into public.it_members(user_id, display_name, role) select admin_id, 'Test administrator', 'IT Admin' from fixture;

set local role authenticated;
do $$
declare f fixture; r jsonb; payload jsonb; req uuid; h uuid; n integer;
begin
  select * into f from fixture;
  perform public.inventory_command(gen_random_uuid(), 'save_it_member', jsonb_build_object('user_id', f.officer_id, 'display_name', 'Test officer', 'role', 'IT Officer'));
  perform public.inventory_command(gen_random_uuid(), 'save_branch', jsonb_build_object('id', f.branch_id, 'name', 'Test branch'));
  perform public.inventory_command(gen_random_uuid(), 'save_location', jsonb_build_object('id', f.location_id, 'branch_id', f.branch_id, 'name', 'Test room'));
  perform public.inventory_command(gen_random_uuid(), 'save_person', jsonb_build_object('id', f.person_id, 'name', 'Test person', 'employee_id', 'TEST-001', 'department', 'Test', 'location_id', f.location_id));
  perform public.inventory_command(gen_random_uuid(), 'save_person', jsonb_build_object('id', f.second_person_id, 'name', 'Second person', 'employee_id', 'TEST-002', 'department', 'Test', 'location_id', f.location_id));

  -- Switch claims to an ordinary IT officer. CRUD and custody work are permitted.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', f.officer_id, 'role', 'authenticated')::text, true);
  payload := jsonb_build_object('id', f.asset_id, 'tag', 'TEST-ASSET', 'name', 'Test laptop', 'category', 'Laptop', 'condition', 'Good', 'location_id', f.location_id);
  perform public.inventory_command(gen_random_uuid(), 'save_asset', payload);
  if (select count(*) from public.assets where id = f.asset_id and serial is null and cost is null) <> 1 then
    raise exception 'Unknown serial and cost must remain NULL';
  end if;
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_asset', payload || jsonb_build_object('id', gen_random_uuid(), 'tag', ' test-asset '));
    raise exception 'Duplicate tag was accepted';
  exception when unique_violation then null; end;
  begin
    update public.assets set name = 'Forged write' where id = f.asset_id;
    raise exception 'Direct asset update was accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.activity_log(actor_id, action, entity_type) values (f.officer_id, 'Forged', 'test');
    raise exception 'Forged activity was accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_settings', jsonb_build_object('organisation', 'Changed', 'verification_days', 90, 'paper_prefix', 'X', 'version', 1));
    raise exception 'Officer changed admin settings';
  exception when insufficient_privilege then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_it_member', jsonb_build_object('user_id', f.officer_id, 'display_name', 'Escalation', 'role', 'IT Admin', 'active', true, 'version', 1));
    raise exception 'Officer escalated privileges';
  exception when insufficient_privilege then null; end;

  req := gen_random_uuid();
  payload := jsonb_build_object('asset_id', f.asset_id, 'asset_version', 1, 'person_id', f.person_id, 'location_id', f.location_id, 'condition', 'Good', 'paper_reference', 'TEST-HO-001');
  r := public.inventory_command(req, 'issue_asset', payload);
  h := (r->>'id')::uuid;
  update fixture set handover_id = h;
  if public.inventory_command(req, 'issue_asset', payload) <> r then raise exception 'Retry returned a different result'; end if;
  if (select count(*) from public.handovers where asset_id = f.asset_id) <> 1 then raise exception 'Retry duplicated handover'; end if;
  begin
    perform public.inventory_command(req, 'issue_asset', payload || '{"paper_reference":"CHANGED"}');
    raise exception 'Reused request ID accepted changed payload';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(), 'issue_asset', payload);
    raise exception 'Stale asset version was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(), 'issue_asset', payload || '{"asset_version":2}');
    raise exception 'Assigned asset was issued twice';
  exception when invalid_parameter_value then null; end;

  -- Closure occurs before the next issue. A later failure must undo the closure.
  payload := jsonb_build_object('asset_id', f.asset_id, 'asset_version', 2, 'handover_id', h, 'person_id', gen_random_uuid(), 'location_id', f.location_id, 'condition', 'Good', 'return_reference', 'TEST-TRANSFER', 'paper_reference', 'TEST-HO-002');
  select count(*) into n from public.activity_log;
  begin
    perform public.inventory_command(gen_random_uuid(), 'transfer_asset', payload);
    raise exception 'Transfer to nonexistent employee was accepted';
  exception when invalid_parameter_value then null; end;
  if not exists (select 1 from public.handovers where id = h and closed_at is null) or (select count(*) from public.activity_log) <> n then
    raise exception 'Failed transfer left partial history';
  end if;
  r := public.inventory_command(gen_random_uuid(), 'transfer_asset', payload || jsonb_build_object('person_id', f.second_person_id));
  h := (r->>'id')::uuid;
  if (select count(*) from public.handovers where asset_id = f.asset_id and closed_at is null) <> 1 or
    (select person_id from public.asset_register where id = f.asset_id) <> f.second_person_id then
    raise exception 'Transfer did not preserve a single current custodian';
  end if;
  perform public.inventory_command(gen_random_uuid(), 'record_signed_form', jsonb_build_object('handover_id', h, 'version', 1, 'filing_location', 'Test cabinet'));
  if not exists (select 1 from public.handovers where id = h and signed_received_by = f.officer_id) then raise exception 'Signed form attribution missing'; end if;
  perform public.inventory_command(gen_random_uuid(), 'return_asset', jsonb_build_object('asset_id', f.asset_id, 'asset_version', 3, 'handover_id', h, 'location_id', f.location_id, 'condition', 'Damaged', 'return_reference', 'TEST-RETURN'));
  if not exists (select 1 from public.asset_register where id = f.asset_id and status = 'Needs service' and person_id is null) then raise exception 'Damaged return is inconsistent'; end if;
  begin
    perform public.inventory_command(gen_random_uuid(), 'issue_asset', jsonb_build_object('asset_id', f.asset_id, 'asset_version', 4, 'person_id', f.person_id, 'location_id', f.location_id, 'condition', 'Good', 'paper_reference', 'INVALID'));
    raise exception 'Damaged asset was issued';
  exception when invalid_parameter_value then null; end;

  -- Unapproved Auth users cannot read inventory or execute commands, even if
  -- they put an administrator role into user-editable JWT user_metadata.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', f.outsider_id, 'role', 'authenticated', 'user_metadata', jsonb_build_object('role','IT Admin'))::text, true);
  if exists (select 1 from public.assets) or exists (select 1 from public.activity_log) or exists (select 1 from public.it_members) then raise exception 'Non-IT read access'; end if;
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_branch', '{"name":"Unauthorized"}');
    raise exception 'Non-IT write access';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', f.admin_id, 'role', 'authenticated')::text, true);
  if (select count(*) from public.it_members where active and role='IT Admin')=1 then
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_it_member', jsonb_build_object('user_id', f.admin_id, 'display_name', 'Test administrator', 'role', 'IT Admin', 'active', false, 'version', 1));
    raise exception 'Last active administrator was disabled';
  exception when invalid_parameter_value then null; end;
  end if;
  perform public.inventory_command(gen_random_uuid(), 'save_it_member', jsonb_build_object('user_id', f.officer_id, 'display_name', 'Test officer', 'role', 'IT Officer', 'active', false, 'version', 1));
  perform set_config('request.jwt.claims', jsonb_build_object('sub', f.officer_id, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.assets) then raise exception 'Disabled officer still has read access'; end if;
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_branch', '{"name":"Disabled"}');
    raise exception 'Disabled officer still has write access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role anon;
do $$ begin
  begin
    perform 1 from public.assets;
    raise exception 'Anonymous read was accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(), 'save_branch', '{"name":"Anonymous"}');
    raise exception 'Anonymous command was accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Access, custody, retries, rollback, version conflict and deactivation assertions passed. Fixtures rolled back.' as result;
