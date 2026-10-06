create table if not exists public.quote_follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  step integer not null default 1 check (step in (1,2)),
  next_due_at timestamptz,
  last_sent_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id)
);

create index if not exists quote_follow_ups_due_idx
  on public.quote_follow_ups (organization_id, status, next_due_at)
  where status = 'scheduled';

alter table public.quote_follow_ups enable row level security;

drop policy if exists quote_follow_ups_member_all on public.quote_follow_ups;
create policy quote_follow_ups_member_all
  on public.quote_follow_ups
  for all
  using (app_private.is_org_member(organization_id))
  with check (app_private.is_org_member(organization_id));

create or replace function public.sync_quote_follow_up_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_due_at timestamptz;
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.sent_at is distinct from new.sent_at) then
    v_due_at := coalesce(new.sent_at, now()) + interval '24 hours';
    insert into public.quote_follow_ups (organization_id,quote_id,customer_id,lead_id,status,step,next_due_at,last_sent_at,cancelled_at,cancel_reason)
    values (new.organization_id,new.id,new.customer_id,new.lead_id,'scheduled',1,v_due_at,null,null,null)
    on conflict (quote_id) do update set
      organization_id=excluded.organization_id,
      customer_id=excluded.customer_id,
      lead_id=excluded.lead_id,
      status='scheduled',step=1,next_due_at=excluded.next_due_at,last_sent_at=null,cancelled_at=null,cancel_reason=null,updated_at=now();
  elsif new.status in ('approved','declined','changes_requested','expired','cancelled') then
    update public.quote_follow_ups
    set status='cancelled',next_due_at=null,cancelled_at=coalesce(cancelled_at,now()),cancel_reason=new.status,updated_at=now()
    where quote_id=new.id and status <> 'completed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_quote_follow_up_state on public.quotes;
create trigger trg_sync_quote_follow_up_state
after insert or update of status, sent_at on public.quotes
for each row execute function public.sync_quote_follow_up_state();

create or replace function public.get_due_quote_follow_ups(p_limit integer default 25)
returns table (follow_up_id uuid,quote_id uuid,quote_number bigint,step integer,next_due_at timestamptz,customer_id uuid,customer_name text,customer_email text,public_token uuid,public_url text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select f.id,q.id,q.quote_number,f.step,f.next_due_at,c.id,c.display_name,c.email,q.public_token,
         rtrim(coalesce(s.public_base_url,'https://rinsepoint.com'),'/') || '/quote/?token=' || q.public_token::text
  from public.quote_follow_ups f
  join public.quotes q on q.id=f.quote_id
  join public.customers c on c.id=f.customer_id
  left join public.organization_settings s on s.organization_id=f.organization_id
  where f.status='scheduled' and f.next_due_at is not null and f.next_due_at <= now()
    and q.status in ('sent','viewed') and c.email is not null
  order by f.next_due_at asc
  limit greatest(1,least(coalesce(p_limit,25),100));
$$;

create or replace function public.complete_quote_follow_up_step(p_follow_up_id uuid)
returns public.quote_follow_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.quote_follow_ups;
  v_quote_status text;
begin
  select q.status into v_quote_status from public.quote_follow_ups f join public.quotes q on q.id=f.quote_id where f.id=p_follow_up_id;
  if v_quote_status not in ('sent','viewed') then
    update public.quote_follow_ups
    set status='cancelled',next_due_at=null,cancelled_at=now(),cancel_reason=coalesce(v_quote_status,'quote_missing'),updated_at=now()
    where id=p_follow_up_id returning * into v_row;
    return v_row;
  end if;
  update public.quote_follow_ups
  set last_sent_at=now(),step=case when step=1 then 2 else step end,
      next_due_at=case when step=1 then now()+interval '3 days' else null end,
      status=case when step=2 then 'completed' else 'scheduled' end,
      updated_at=now()
  where id=p_follow_up_id and status='scheduled'
  returning * into v_row;
  return v_row;
end;
$$;

insert into public.quote_follow_ups (organization_id,quote_id,customer_id,lead_id,status,step,next_due_at)
select q.organization_id,q.id,q.customer_id,q.lead_id,'scheduled',1,coalesce(q.sent_at,q.updated_at)+interval '24 hours'
from public.quotes q
where q.status in ('sent','viewed')
  and not exists (select 1 from public.quote_follow_ups f where f.quote_id=q.id)
on conflict (quote_id) do nothing;
