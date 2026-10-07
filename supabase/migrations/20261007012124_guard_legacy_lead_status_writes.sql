create or replace function public.guard_legacy_lead_status_write()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status in ('closed_won','closed_lost','do_not_contact') then
    raise exception 'Use the guarded lead lifecycle action instead of changing terminal status directly';
  end if;

  -- Backward compatibility for the current UI while it transitions to stage/outcome.
  new.outcome := 'open';
  new.closed_at := null;
  new.lost_reason := null;
  new.stage := case new.status
    when 'new' then 'new'
    when 'contacted' then 'contacted'
    when 'qualified' then 'qualified'
    when 'quote_needed' then 'estimate_needed'
    else new.stage
  end;
  new.stage_entered_at := now();

  return new;
end;
$$;

drop trigger if exists leads_guard_legacy_status_write on public.leads;
create trigger leads_guard_legacy_status_write
before update of status on public.leads
for each row execute function public.guard_legacy_lead_status_write();
