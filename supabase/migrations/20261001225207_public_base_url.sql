-- Phase 0 / Batch 2: centralize stable public customer-facing URL configuration.

alter table public.organization_settings
  add column if not exists public_base_url text;

update public.organization_settings
set public_base_url = 'https://rinsepoint.com'
where public_base_url is null or btrim(public_base_url) = '';

alter table public.organization_settings
  alter column public_base_url set default 'https://rinsepoint.com',
  alter column public_base_url set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_settings_public_base_url_https_check'
      and conrelid = 'public.organization_settings'::regclass
  ) then
    alter table public.organization_settings
      add constraint organization_settings_public_base_url_https_check
      check (public_base_url ~ '^https://[^[:space:]]+$');
  end if;
end
$$;
