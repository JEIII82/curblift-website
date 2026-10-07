alter table public.quote_follow_ups add column if not exists delivery_token uuid;
alter table public.quote_follow_ups add column if not exists automation_event_id bigint references public.automation_events(id) on delete set null;
alter table public.integration_settings add column if not exists make_quote_followup_webhook_url text;

drop function if exists public.claim_due_quote_follow_ups(integer);

create or replace function public.claim_due_quote_follow_ups(p_limit integer default 25)
returns table (
  follow_up_id uuid, quote_id uuid, quote_number bigint, step integer, attempt integer,
  next_due_at timestamptz, customer_id uuid, customer_name text, customer_first_name text,
  customer_email text, total numeric, expires_at timestamptz, public_token uuid,
  public_url text, delivery_token uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.quote_follow_ups
  set status='scheduled', locked_at=null, delivery_token=null,
      next_due_at=least(coalesce(next_due_at,now()),now()), updated_at=now()
  where status='processing' and locked_at < now()-interval '15 minutes';

  return query
  with candidates as (
    select f.id
    from public.quote_follow_ups f
    join public.quotes q on q.id=f.quote_id
    join public.customers c on c.id=f.customer_id
    where f.status='scheduled' and f.next_due_at is not null and f.next_due_at<=now()
      and q.status in ('sent','viewed') and c.email is not null and f.attempts<5
    order by f.next_due_at asc
    for update of f skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.quote_follow_ups f
    set status='processing', locked_at=now(), attempts=f.attempts+1,
        delivery_token=gen_random_uuid(), last_error=null, updated_at=now()
    from candidates c where f.id=c.id returning f.*
  )
  select c.id,q.id,q.quote_number,c.step,c.attempts,c.next_due_at,cu.id,cu.display_name,
         coalesce(nullif(split_part(btrim(cu.display_name),' ',1),''),'there'),
         cu.email,q.total,q.expires_at,q.public_token,
         rtrim(coalesce(s.public_base_url,'https://rinsepoint.com'),'/') || '/quote/?token=' || q.public_token::text,
         c.delivery_token
  from claimed c
  join public.quotes q on q.id=c.quote_id
  join public.customers cu on cu.id=c.customer_id
  left join public.organization_settings s on s.organization_id=c.organization_id
  order by c.next_due_at asc;
end;
$$;

create or replace function public.complete_quote_follow_up_step(p_follow_up_id uuid,p_delivery_token uuid)
returns public.quote_follow_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.quote_follow_ups; v_quote_status text;
begin
  select q.status into v_quote_status
  from public.quote_follow_ups f join public.quotes q on q.id=f.quote_id
  where f.id=p_follow_up_id and f.delivery_token=p_delivery_token and f.status='processing';
  if not found then return null; end if;
  if v_quote_status not in ('sent','viewed') then
    update public.quote_follow_ups
    set status='cancelled',next_due_at=null,locked_at=null,delivery_token=null,
        cancelled_at=now(),cancel_reason=coalesce(v_quote_status,'quote_missing'),updated_at=now()
    where id=p_follow_up_id and delivery_token=p_delivery_token returning * into v_row;
    return v_row;
  end if;
  update public.quote_follow_ups
  set last_sent_at=now(), status=case when step=1 then 'scheduled' else 'completed' end,
      step=case when step=1 then 2 else step end,
      next_due_at=case when step=1 then now()+interval '3 days' else null end,
      locked_at=null,delivery_token=null,last_error=null,automation_event_id=null,updated_at=now()
  where id=p_follow_up_id and status='processing' and delivery_token=p_delivery_token
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.fail_quote_follow_up_step(p_follow_up_id uuid,p_delivery_token uuid,p_error text default null)
returns public.quote_follow_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.quote_follow_ups;
begin
  update public.quote_follow_ups
  set status=case when attempts>=5 then 'failed' else 'scheduled' end,
      next_due_at=case when attempts>=5 then null else now()+interval '15 minutes' end,
      locked_at=null,delivery_token=null,last_error=left(coalesce(p_error,'Delivery failed'),2000),
      automation_event_id=null,updated_at=now()
  where id=p_follow_up_id and status='processing' and delivery_token=p_delivery_token
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.claim_due_quote_follow_ups(integer) from public,anon,authenticated;
revoke all on function public.complete_quote_follow_up_step(uuid,uuid) from public,anon,authenticated;
revoke all on function public.fail_quote_follow_up_step(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_due_quote_follow_ups(integer) to service_role;
grant execute on function public.complete_quote_follow_up_step(uuid,uuid) to service_role;
grant execute on function public.fail_quote_follow_up_step(uuid,uuid,text) to service_role;
