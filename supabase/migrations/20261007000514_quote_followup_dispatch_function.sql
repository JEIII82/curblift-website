create or replace function public.dispatch_due_quote_followups(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_webhook_url text;
  v_callback_url text := 'https://cfrdooivdzjuqsauhaqy.supabase.co/functions/v1/quote-followup-callback';
  v_item record;
  v_event_id bigint;
  v_request_id bigint;
  v_count integer := 0;
  v_payload jsonb;
begin
  select make_quote_followup_webhook_url
    into v_webhook_url
  from public.integration_settings
  where organization_id='00000000-0000-4000-8000-000000000001';

  if coalesce(v_webhook_url,'') = '' then return 0; end if;

  for v_item in select * from public.claim_due_quote_follow_ups(p_limit)
  loop
    begin
      v_payload := jsonb_build_object(
        'eventType','quote.followup_due',
        'followUpId',v_item.follow_up_id,
        'deliveryToken',v_item.delivery_token,
        'quoteId',v_item.quote_id,
        'quoteNumber',v_item.quote_number,
        'step',v_item.step,
        'attempt',v_item.attempt,
        'customerName',v_item.customer_name,
        'customerFirstName',v_item.customer_first_name,
        'customerEmail',v_item.customer_email,
        'total',v_item.total,
        'expiresAt',v_item.expires_at,
        'publicUrl',v_item.public_url,
        'callbackUrl',v_callback_url
      );

      insert into public.automation_events (
        organization_id,event_type,entity_type,entity_id,payload,status,attempts,available_at,dedupe_key
      ) values (
        '00000000-0000-4000-8000-000000000001',
        'quote.followup_due','quote',v_item.quote_id,v_payload,'processing',v_item.attempt,now(),
        format('quote.followup:%s:step:%s:attempt:%s',v_item.follow_up_id,v_item.step,v_item.attempt)
      ) returning id into v_event_id;

      update public.quote_follow_ups
      set automation_event_id=v_event_id,updated_at=now()
      where id=v_item.follow_up_id and delivery_token=v_item.delivery_token and status='processing';

      select net.http_post(
        url := v_webhook_url,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := v_payload
      ) into v_request_id;

      update public.automation_events
      set payload=payload || jsonb_build_object('netRequestId',v_request_id)
      where id=v_event_id;

      v_count := v_count+1;
    exception when others then
      if v_event_id is not null then
        update public.automation_events
        set status='failed',processed_at=now(),last_error=left(sqlerrm,2000)
        where id=v_event_id;
      end if;
      perform public.fail_quote_follow_up_step(v_item.follow_up_id,v_item.delivery_token,sqlerrm);
    end;
    v_event_id := null;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.dispatch_due_quote_followups(integer) from public,anon,authenticated;
grant execute on function public.dispatch_due_quote_followups(integer) to service_role;
