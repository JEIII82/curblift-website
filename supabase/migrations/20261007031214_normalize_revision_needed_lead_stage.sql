alter table public.leads drop constraint if exists leads_stage_check;

update public.leads
set stage = 'revision_needed', updated_at = now()
where stage = 'quote_draft';

alter table public.leads
  add constraint leads_stage_check
  check (stage in ('new','contacted','qualified','estimate_needed','quote_sent','follow_up','revision_needed'));

create or replace function public.sync_lead_legacy_status()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
begin
  if tg_op = 'INSERT' or old.stage is distinct from new.stage then
    new.stage_entered_at := now();
  end if;

  if new.outcome = 'won' then
    new.status := 'closed_won';
    new.closed_at := coalesce(new.closed_at, now());
    new.lost_reason := null;
  elsif new.outcome = 'lost' then
    new.status := 'closed_lost';
    new.closed_at := coalesce(new.closed_at, now());
  elsif new.outcome = 'do_not_contact' then
    new.status := 'do_not_contact';
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.status := case new.stage
      when 'new' then 'new'
      when 'contacted' then 'contacted'
      when 'qualified' then 'qualified'
      when 'estimate_needed' then 'quote_needed'
      when 'revision_needed' then 'qualified'
      when 'quote_sent' then 'qualified'
      when 'follow_up' then 'qualified'
      else 'new'
    end;
  end if;

  return new;
end;
$$;

create or replace function public.sync_lead_lifecycle_from_quote()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  v_updated integer := 0;
begin
  if new.lead_id is null or old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'sent' then
    update public.leads
    set stage = 'quote_sent',
        first_contacted_at = coalesce(first_contacted_at, now()),
        qualified_at = coalesce(qualified_at, now()),
        updated_at = now()
    where id = new.lead_id
      and organization_id = new.organization_id
      and outcome = 'open';

    get diagnostics v_updated = row_count;

    update public.tasks
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where organization_id = new.organization_id
      and lead_id = new.lead_id
      and status = 'open'
      and title = 'Review new website quote request';

  elsif new.status = 'changes_requested' then
    update public.leads
    set stage = 'revision_needed',
        updated_at = now()
    where id = new.lead_id
      and organization_id = new.organization_id
      and outcome = 'open';
    get diagnostics v_updated = row_count;

  elsif new.status = 'approved' then
    update public.leads
    set outcome = 'won',
        closed_at = coalesce(closed_at, now()),
        lost_reason = null,
        updated_at = now()
    where id = new.lead_id
      and organization_id = new.organization_id
      and outcome is distinct from 'won';
    get diagnostics v_updated = row_count;

    update public.tasks
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where organization_id = new.organization_id
      and lead_id = new.lead_id
      and status = 'open';

  elsif new.status = 'declined' then
    update public.leads
    set outcome = 'lost',
        closed_at = coalesce(closed_at, now()),
        lost_reason = coalesce(nullif(lost_reason, ''), 'Customer declined quote #' || new.quote_number::text),
        updated_at = now()
    where id = new.lead_id
      and organization_id = new.organization_id
      and outcome <> 'won';
    get diagnostics v_updated = row_count;
  end if;

  if v_updated > 0 then
    insert into public.activity_events (
      organization_id, actor_type, customer_id, entity_type, entity_id, event_type, summary, metadata
    ) values (
      new.organization_id,
      'system',
      new.customer_id,
      'lead',
      new.lead_id,
      'lead.lifecycle_synced',
      'Lead lifecycle updated from quote #' || new.quote_number::text,
      jsonb_build_object('quoteId', new.id, 'quoteNumber', new.quote_number, 'quoteStatus', new.status)
    );
  end if;

  return new;
end;
$$;