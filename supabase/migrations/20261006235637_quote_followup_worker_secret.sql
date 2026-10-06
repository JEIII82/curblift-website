alter table public.integration_settings add column if not exists quote_followup_worker_secret text;
update public.integration_settings
set quote_followup_worker_secret = replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
where quote_followup_worker_secret is null;
alter table public.integration_settings alter column quote_followup_worker_secret set not null;
