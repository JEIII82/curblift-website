create or replace function public.guard_lead_outcome_transition()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if tg_op = 'UPDATE' and old.outcome = 'won' and new.outcome <> 'won' then
    raise exception 'Won leads cannot be reopened from a direct database update';
  end if;

  if new.outcome = 'open' and new.closed_at is not null and (tg_op = 'INSERT' or old.outcome is distinct from new.outcome) then
    new.closed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_guard_outcome_transition on public.leads;
create trigger leads_guard_outcome_transition
before insert or update of outcome on public.leads
for each row execute function public.guard_lead_outcome_transition();
