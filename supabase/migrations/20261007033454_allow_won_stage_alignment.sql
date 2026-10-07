create or replace function public.guard_manual_lead_stage()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op = 'UPDATE' and old.stage is distinct from new.stage then
    if new.outcome <> 'open' then
      if not (
        new.outcome = 'won'
        and new.stage = 'quote_sent'
        and exists (
          select 1 from public.quotes q
          where q.lead_id = new.id
            and q.organization_id = new.organization_id
            and q.status = 'approved'
        )
      ) then
        raise exception 'Closed leads cannot change stage';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

update public.leads l
set stage = 'quote_sent', updated_at = now()
where l.outcome = 'won'
  and l.stage is distinct from 'quote_sent'
  and exists (
    select 1 from public.quotes q
    where q.lead_id = l.id
      and q.organization_id = l.organization_id
      and q.status = 'approved'
  );
