create unique index if not exists communications_quote_followup_provider_unique
on public.communications (provider, provider_message_id)
where provider_message_id is not null and quote_id is not null;
