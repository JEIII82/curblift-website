-- Keep the dashboard work queue and lead statuses aligned with quote progress.

create or replace function public.progress_lead_when_quote_sent()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_updated integer := 0;
begin
  if new.status = 'sent'
     and old.status is distinct from new.status
     and new.lead_id is not null then

    update public.leads
    set status = 'qualified',
        first_contacted_at = coalesce(first_contacted_at, now()),
        qualified_at = coalesce(qualified_at, now()),
        updated_at = now()
    where id = new.lead_id
      and organization_id = new.organization_id
      and status in ('new', 'contacted', 'quote_needed');

    get diagnostics v_updated = row_count;

    update public.tasks
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where organization_id = new.organization_id
      and lead_id = new.lead_id
      and status = 'open'
      and title = 'Review new website quote request';

    if v_updated > 0 then
      insert into public.activity_events (
        organization_id,
        actor_type,
        customer_id,
        entity_type,
        entity_id,
        event_type,
        summary,
        metadata
      ) values (
        new.organization_id,
        'system',
        new.customer_id,
        'lead',
        new.lead_id,
        'lead.progressed',
        'Lead progressed after quote sent',
        jsonb_build_object('quoteId', new.id, 'quoteNumber', new.quote_number)
      );
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.progress_lead_when_quote_sent() from public;

DROP TRIGGER IF EXISTS quotes_progress_lead_after_send ON public.quotes;
create trigger quotes_progress_lead_after_send
after update of status on public.quotes
for each row
execute function public.progress_lead_when_quote_sent();

-- Backfill leads that already have an active sent/viewed quote but were left as New.
update public.leads l
set status = 'qualified',
    first_contacted_at = coalesce(l.first_contacted_at, q.first_sent_at),
    qualified_at = coalesce(l.qualified_at, q.first_sent_at),
    updated_at = now()
from (
  select lead_id, min(sent_at) as first_sent_at
  from public.quotes
  where lead_id is not null
    and status in ('sent', 'viewed', 'changes_requested')
  group by lead_id
) q
where l.id = q.lead_id
  and l.status in ('new', 'contacted', 'quote_needed');

-- Complete initial lead-review tasks when the quote has already been sent.
update public.tasks t
set status = 'completed',
    completed_at = coalesce(t.completed_at, now()),
    updated_at = now()
where t.status = 'open'
  and t.title = 'Review new website quote request'
  and exists (
    select 1
    from public.quotes q
    where q.lead_id = t.lead_id
      and q.organization_id = t.organization_id
      and q.status in ('sent', 'viewed', 'changes_requested', 'approved')
  );

-- Older untouched new leads predate automatic task creation. Give them a real queue item.
insert into public.tasks (
  organization_id,
  customer_id,
  lead_id,
  title,
  description,
  status,
  priority,
  due_at
)
select
  l.organization_id,
  l.customer_id,
  l.id,
  case when l.source = 'website' then 'Review new website quote request' else 'Review new lead' end,
  'Review the new request and make first contact.',
  'open',
  'normal',
  coalesce(l.created_at, now())
from public.leads l
where l.status = 'new'
  and not exists (
    select 1
    from public.tasks t
    where t.organization_id = l.organization_id
      and t.lead_id = l.id
      and t.status = 'open'
  );
