-- Resolve branch names and save their locations in the same transaction.
create or replace function private.save_directory(p_kind text, p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_version integer := (p->>'version')::integer;
  v_result jsonb;
  v_branch uuid;
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
    if p ? 'branch_name' then
      select id into v_branch from public.branches where lower(trim(name))=lower(trim(p->>'branch_name')) and active;
      if v_branch is null then
        insert into public.branches(name) values(trim(p->>'branch_name')) on conflict do nothing returning id into v_branch;
        if v_branch is null then select id into v_branch from public.branches where lower(trim(name))=lower(trim(p->>'branch_name')) and active; end if;
      end if;
      p := p || jsonb_build_object('branch_id',v_branch);
    end if;
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

-- Keep discrepancy categories aligned with the department's existing forms.
alter table public.discrepancies drop constraint discrepancies_type_check;
alter table public.discrepancies add constraint discrepancies_type_check check
  (type in ('Location mismatch','Damage','Not seen','Custody mismatch','Custodian mismatch','Missing accessory','Label damaged','Other'));
