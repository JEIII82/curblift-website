create or replace function public.claim_due_quote_follow_ups(p_limit integer default 25)
returns table(
  follow_up_id uuid,
  quote_id uuid,
  quote_number bigint,
  step integer,
  attempt integer,
  next_due_at timestamptz,
  customer_id uuid,
  customer_name text,
  customer_first_name text,
  customer_email text,
  total numeric,
  expires_at timestamptz,
  public_token uuid,
  public_url text,
  delivery_token uuid
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.quote_follow_ups as f
  set status='scheduled',
      locked_at=null,
      delivery_token=null,
      next_due_at=least(coalesce(f.next_due_at,now()),now()),
      updated_at=now()
  where f.status='processing'
    and f.locked_at < now()-interval '15 minutes';

  return query
  with candidates as (
    select f.id
    from public.quote_follow_ups f
    join public.quotes q on q.id=f.quote_id
    join public.customers c on c.id=f.customer_id
    where f.status='scheduled'
      and f.next_due_at is not null
      and f.next_due_at <= now()
      and q.status in ('sent','viewed')
      and c.email is not null
      and f.attempts < 5
    order by f.next_due_at asc
    for update of f skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.quote_follow_ups f
    set status='processing',
        locked_at=now(),
        attempts=f.attempts+1,
        delivery_token=gen_random_uuid(),
        last_error=null,
        updated_at=now()
    from candidates c
    where f.id=c.id
    returning f.*
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
