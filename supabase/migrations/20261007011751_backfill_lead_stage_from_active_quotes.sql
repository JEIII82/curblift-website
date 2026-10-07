update public.leads l
set stage = case
      when exists (select 1 from public.quotes q where q.lead_id=l.id and q.status='changes_requested') then 'quote_draft'
      when exists (select 1 from public.quotes q where q.lead_id=l.id and q.status in ('sent','viewed')) then 'quote_sent'
      else l.stage
    end,
    updated_at = now()
where l.outcome='open'
  and exists (
    select 1 from public.quotes q
    where q.lead_id=l.id and q.status in ('sent','viewed','changes_requested')
  );
