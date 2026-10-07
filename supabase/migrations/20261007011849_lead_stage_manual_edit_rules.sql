create or replace function public.guard_manual_lead_stage()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE' and old.stage is distinct from new.stage then
    if new.outcome <> 'open' then
      raise exception 'Closed leads cannot change stage';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_guard_manual_stage on public.leads;
create trigger leads_guard_manual_stage
before update of stage on public.leads
for each row execute function public.guard_manual_lead_stage();
