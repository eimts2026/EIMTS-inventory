-- Run against a provisioned project. All test data and events are rolled back.
begin;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'role','authenticated')::text,true)
from public.it_members where active and role='IT Admin' order by created_at limit 1;
set local role authenticated;
do $$
declare
  room uuid:=gen_random_uuid(); device uuid:=gen_random_uuid(); person uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid(); payload jsonb; result jsonb; repair uuid; av integer;
begin
  perform public.inventory_command(gen_random_uuid(),'save_location',jsonb_build_object('id',room,'name','Maintenance test room','branch_name','Maintenance tests'));
  perform public.inventory_command(gen_random_uuid(),'save_person',jsonb_build_object('id',person,'name','Maintenance test custodian','employee_id',person::text,'department','IT','location_id',room));
  perform public.inventory_command(gen_random_uuid(),'save_asset',jsonb_build_object('id',device,'tag',device::text,'name','Maintenance test device','category','Laptop','condition','Good','location_id',room));
  payload:=jsonb_build_object('asset_id',device,'asset_version',1,'problem','Test fault','vendor','Internal IT','due_on',current_date+7,'paper_reference','TEST-SERVICE');
  begin
    perform public.inventory_command(gen_random_uuid(),'open_repair',payload||jsonb_build_object('due_on',current_date-1));
    raise exception 'Past due date accepted';
  exception when invalid_parameter_value then null; end;
  result:=public.inventory_command(req,'open_repair',payload);
  repair:=(result->>'id')::uuid;
  if public.inventory_command(req,'open_repair',payload)<>result then raise exception 'Retry result differs'; end if;
  if not exists(select 1 from public.assets where id=device and status='In repair' and version=2) then raise exception 'Asset not in repair'; end if;
  if (select count(*) from public.repairs where asset_id=device)<>1 then raise exception 'Retry duplicated repair'; end if;
  begin
    perform public.inventory_command(gen_random_uuid(),'open_repair',payload);
    raise exception 'Stale request accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(),'open_repair',payload||'{"asset_version":2}');
    raise exception 'Duplicate open repair accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(),'issue_asset',jsonb_build_object('asset_id',device,'asset_version',2,'person_id',person,'location_id',room,'condition','Good','paper_reference','TEST-ISSUE'));
    raise exception 'Device in repair was issued';
  exception when invalid_parameter_value then null; end;
  payload:=jsonb_build_object('asset_id',device,'asset_version',2,'repair_id',repair,'version',1,'cost',2500.50,'resolution','Repaired and checked','ready_for_stock',false);
  begin
    perform public.inventory_command(gen_random_uuid(),'complete_repair',payload);
    raise exception 'Unchecked device accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(),'complete_repair',payload||'{"ready_for_stock":true,"cost":-1}');
    raise exception 'Negative cost accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.inventory_command(gen_random_uuid(),'complete_repair',payload||'{"ready_for_stock":true,"version":99}');
    raise exception 'Stale repair accepted';
  exception when serialization_failure then null; end;
  req:=gen_random_uuid(); payload:=payload||'{"ready_for_stock":true}';
  result:=public.inventory_command(req,'complete_repair',payload);
  if public.inventory_command(req,'complete_repair',payload)<>result then raise exception 'Completion retry differs'; end if;
  if not exists(select 1 from public.assets where id=device and status='Available' and condition='Good' and version=3) then raise exception 'Asset not restored'; end if;
  if not exists(select 1 from public.repairs where id=repair and closed_by=auth.uid() and opened_by=auth.uid() and closed_at is not null and cost=2500.50) then raise exception 'Completion details missing'; end if;
  if (select count(*) from public.activity_log where entity_type='repairs' and entity_id=repair)<>2 then raise exception 'Repair audit history missing'; end if;
  if not exists(select 1 from jsonb_array_elements(public.inventory_snapshot()->'repairs') r where r->>'id'=repair::text) then raise exception 'Repair missing from snapshot'; end if;
  begin
    update public.repairs set cost=0 where id=repair;
    raise exception 'Direct client write allowed';
  exception when insufficient_privilege then null; end;
  perform public.inventory_command(gen_random_uuid(),'issue_asset',jsonb_build_object('asset_id',device,'asset_version',3,'person_id',person,'location_id',room,'condition','Good','paper_reference','TEST-ISSUE'));
  begin
    perform public.inventory_command(gen_random_uuid(),'open_repair',jsonb_build_object('asset_id',device,'asset_version',4,'problem','Fault','vendor','Internal IT','due_on',current_date+7));
    raise exception 'Assigned device accepted for repair';
  exception when invalid_parameter_value then null; end;
end $$;
-- A valid Auth token without IT membership must not read repair records or run commands.
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.repairs) then raise exception 'Non-IT caller read repair history'; end if;
  begin
    perform public.inventory_command(gen_random_uuid(),'open_repair','{}');
    raise exception 'Non-IT caller ran command';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.repairs;
    raise exception 'Anonymous read permitted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Maintenance lifecycle, retry, version, custody, audit, snapshot and access checks passed. Fixtures rolled back.' as result;
