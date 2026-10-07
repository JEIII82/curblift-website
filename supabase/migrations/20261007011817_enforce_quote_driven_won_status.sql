create or replace function public.block_manual_won_without_approved_quote()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
begin
  if new.outcome = 'won' and (tg_op = 'INSERT' or old.outcome is distinct from new.outcome) then
    if not exists (
      select 1 from public.quotes q
      where q.lead_id = new.id
        and q.organization_id = new.organization_id
        and q.status = 'approved'
    ) then
      raise exception 'Lead can only become won from an approved quote';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_block_manual_won on public.leads;
create trigger leads_block_manual_won
before insert or update of outcome on public.leads
for each row execute function public.block_manual_won_without_approved_quote();
