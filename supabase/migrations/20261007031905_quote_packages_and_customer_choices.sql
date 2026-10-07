create table if not exists public.quote_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  name text not null,
  tier text not null default 'custom' check (tier in ('good','better','best','custom')),
  description text,
  is_recommended boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists quote_packages_one_recommended_per_quote
  on public.quote_packages(quote_id)
  where is_recommended;
create index if not exists quote_packages_quote_id_idx on public.quote_packages(quote_id, sort_order);

alter table public.quote_packages enable row level security;
drop policy if exists quote_packages_member_all on public.quote_packages;
create policy quote_packages_member_all on public.quote_packages
  for all
  using (exists (
    select 1 from public.quotes q
    where q.id = quote_packages.quote_id
      and app_private.is_org_member(q.organization_id)
  ))
  with check (exists (
    select 1 from public.quotes q
    where q.id = quote_packages.quote_id
      and q.organization_id = quote_packages.organization_id
      and app_private.is_org_member(q.organization_id)
  ));

grant select, insert, update, delete on public.quote_packages to authenticated;

alter table public.quote_items
  add column if not exists package_id uuid references public.quote_packages(id) on delete cascade;
create index if not exists quote_items_package_id_idx on public.quote_items(package_id);

alter table public.quotes
  add column if not exists selected_package_id uuid references public.quote_packages(id) on delete set null;

create or replace function public.validate_quote_selected_package()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
begin
  if new.selected_package_id is not null and not exists (
    select 1 from public.quote_packages p
    where p.id = new.selected_package_id
      and p.quote_id = new.id
      and p.organization_id = new.organization_id
  ) then
    raise exception 'Selected package must belong to this quote';
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_validate_selected_package on public.quotes;
create trigger quotes_validate_selected_package
before insert or update of selected_package_id on public.quotes
for each row execute function public.validate_quote_selected_package();

create or replace function public.recalculate_quote_totals(target_quote_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $$
declare
  new_subtotal numeric(12,2);
  v_selected_package_id uuid;
begin
  select selected_package_id
    into v_selected_package_id
  from public.quotes
  where id = target_quote_id;

  select coalesce(sum(line_total), 0)
    into new_subtotal
  from public.quote_items
  where quote_id = target_quote_id
    and (
      (package_id is null and (optional = false or selected = true))
      or
      (package_id = v_selected_package_id and (optional = false or selected = true))
    );

  update public.quotes
  set subtotal = new_subtotal,
      updated_at = now()
  where id = target_quote_id;
end;
$$;

create or replace function public.quote_package_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_quote_totals(old.quote_id);
    return old;
  end if;
  perform public.recalculate_quote_totals(new.quote_id);
  if tg_op = 'UPDATE' and old.quote_id is distinct from new.quote_id then
    perform public.recalculate_quote_totals(old.quote_id);
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_recalculate_after_package_selection on public.quotes;
create trigger quotes_recalculate_after_package_selection
after update of selected_package_id on public.quotes
for each row
when (old.selected_package_id is distinct from new.selected_package_id)
execute function public.quote_package_recalculate_trigger();