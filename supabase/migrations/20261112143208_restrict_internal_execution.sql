-- Supabase supplies this event trigger on newly created projects. It only needs
-- database-owner execution. Revoke inherited API grants when it is present.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Explicit deny documents that retry receipts are internal bookkeeping.
create policy command_receipts_deny_clients on private.command_receipts
for all to authenticated using (false) with check (false);
