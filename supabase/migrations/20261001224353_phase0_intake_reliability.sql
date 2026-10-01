-- Phase 0 / Batch 1: make website lead intake transactional, attributable, and duplicate-safe.

alter table public.leads
  add column if not exists submitted_at timestamptz,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists gclid text,
  add column if not exists fbclid text,
  add column if not exists duplicate_review_required boolean not null default false,
  add column if not exists duplicate_candidate_customer_id uuid,
  add column if not exists duplicate_reason text;

update public.leads
set submitted_at = created_at
where submitted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_duplicate_candidate_customer_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_duplicate_candidate_customer_id_fkey
      foreign key (duplicate_candidate_customer_id)
      references public.customers(id)
      on delete set null;
  end if;
end
$$;

create index if not exists leads_duplicate_review_idx
  on public.leads (organization_id, created_at desc)
  where duplicate_review_required = true;

create index if not exists leads_attribution_idx
  on public.leads (organization_id, utm_source, utm_campaign, created_at desc);

create or replace function public.intake_website_lead(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org_id uuid := '00000000-0000-4000-8000-000000000001';

  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_name_key text;
  v_first_name text;
  v_last_name text;

  v_phone text := regexp_replace(coalesce(p_payload->>'phone', ''), '\D', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_payload->>'email', ''))), '');

  v_address_line1 text := btrim(coalesce(p_payload->>'addressLine1', ''));
  v_address_key text;
  v_city text := btrim(coalesce(p_payload->>'city', ''));
  v_city_key text;
  v_state text := upper(btrim(coalesce(nullif(p_payload->>'state', ''), 'TX')));
  v_postal_code text := upper(btrim(coalesce(p_payload->>'postalCode', '')));

  v_service text := btrim(coalesce(p_payload->>'service', ''));
  v_message text := btrim(coalesce(p_payload->>'message', ''));
  v_package text := nullif(btrim(coalesce(p_payload->>'package', '')), '');

  v_preferred_contact text := lower(btrim(coalesce(p_payload->>'preferredContact', '')));
  v_sms_consent boolean := lower(coalesce(p_payload->>'smsConsent', 'false')) in ('true', 'yes', '1', 'on');

  v_landing_page text := nullif(btrim(coalesce(p_payload->>'landingPage', p_payload->>'pageUrl', '')), '');
  v_referrer text := nullif(btrim(coalesce(p_payload->>'referrer', '')), '');
  v_utm_source text := nullif(btrim(coalesce(p_payload->>'utmSource', '')), '');
  v_utm_medium text := nullif(btrim(coalesce(p_payload->>'utmMedium', '')), '');
  v_utm_campaign text := nullif(btrim(coalesce(p_payload->>'utmCampaign', '')), '');
  v_utm_content text := nullif(btrim(coalesce(p_payload->>'utmContent', '')), '');
  v_utm_term text := nullif(btrim(coalesce(p_payload->>'utmTerm', '')), '');
  v_gclid text := nullif(btrim(coalesce(p_payload->>'gclid', '')), '');
  v_fbclid text := nullif(btrim(coalesce(p_payload->>'fbclid', '')), '');

  v_submitted_at timestamptz := coalesce(nullif(p_payload->>'submittedAt', '')::timestamptz, now());
  v_request_id text := btrim(coalesce(p_payload->>'requestId', ''));

  v_existing_lead_id uuid;
  v_customer_id uuid;
  v_property_id uuid;
  v_lead_id uuid;
  v_task_id uuid;
  v_automation_event_id bigint;

  v_customer_created boolean := false;
  v_property_created boolean := false;

  v_duplicate_candidate_id uuid;
  v_duplicate_reason text;
  v_duplicate_review_required boolean := false;
begin
  if v_name = ''
    or length(v_phone) < 10
    or length(v_phone) > 15
    or v_address_line1 = ''
    or v_city = ''
    or v_postal_code = ''
    or v_service = ''
    or v_message = ''
    or v_request_id = '' then
    raise exception 'Missing or invalid required lead-intake fields'
      using errcode = '22023';
  end if;

  if v_email is not null and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email address'
      using errcode = '22023';
  end if;

  if v_state !~ '^[A-Z]{2}$' then
    raise exception 'Invalid state'
      using errcode = '22023';
  end if;

  if v_postal_code !~ '^[0-9]{5}(-[0-9]{4})?$' then
    raise exception 'Invalid ZIP code'
      using errcode = '22023';
  end if;

  if v_preferred_contact not in ('email', 'phone', 'sms') then
    v_preferred_contact := case
      when v_sms_consent then 'sms'
      when v_email is not null then 'email'
      else 'phone'
    end;
  end if;

  if v_preferred_contact = 'sms' and not v_sms_consent then
    v_preferred_contact := case when v_email is not null then 'email' else 'phone' end;
  end if;

  v_name_key := regexp_replace(lower(v_name), '\s+', ' ', 'g');
  v_address_key := regexp_replace(lower(v_address_line1), '\s+', ' ', 'g');
  v_city_key := regexp_replace(lower(v_city), '\s+', ' ', 'g');

  v_first_name := split_part(v_name, ' ', 1);
  v_last_name := nullif(btrim(substr(v_name, length(v_first_name) + 1)), '');

  -- Serialize retries/races for the same browser submission before checking the unique key.
  perform pg_advisory_xact_lock(hashtextextended(v_request_id, 0));

  select id
  into v_existing_lead_id
  from public.leads
  where organization_id = v_org_id
    and external_id = v_request_id
  limit 1;

  if v_existing_lead_id is not null then
    return jsonb_build_object(
      'ok', true,
      'leadId', v_existing_lead_id,
      'duplicate', true,
      'duplicateReviewRequired', false
    );
  end if;

  -- Strongest identity: both submitted email and phone match the same customer.
  if v_email is not null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.organization_id = v_org_id
      and c.archived_at is null
      and lower(c.email) = v_email
      and c.phone = v_phone
    order by c.created_at
    limit 1;
  end if;

  -- Safe fallback: email + name agree and there is no conflicting stored phone.
  if v_customer_id is null and v_email is not null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.organization_id = v_org_id
      and c.archived_at is null
      and lower(c.email) = v_email
      and regexp_replace(lower(btrim(c.display_name)), '\s+', ' ', 'g') = v_name_key
      and (nullif(c.phone, '') is null or c.phone = v_phone)
    order by c.created_at
    limit 1;
  end if;

  -- Safe fallback: phone + name agree and there is no conflicting stored email.
  if v_customer_id is null then
    select c.id
    into v_customer_id
    from public.customers c
    where c.organization_id = v_org_id
      and c.archived_at is null
      and c.phone = v_phone
      and regexp_replace(lower(btrim(c.display_name)), '\s+', ' ', 'g') = v_name_key
      and (c.email is null or v_email is null or lower(c.email) = v_email)
    order by c.created_at
    limit 1;
  end if;

  -- If a single identifier matches but the identity conflicts, preserve this submission
  -- as its own customer and flag the lead for later duplicate review.
  if v_customer_id is null then
    select
      c.id,
      case
        when v_email is not null and lower(c.email) = v_email then 'email_identity_conflict'
        when c.phone = v_phone then 'phone_identity_conflict'
        else 'possible_duplicate'
      end
    into v_duplicate_candidate_id, v_duplicate_reason
    from public.customers c
    where c.organization_id = v_org_id
      and c.archived_at is null
      and (
        (v_email is not null and lower(c.email) = v_email)
        or c.phone = v_phone
      )
    order by
      case when v_email is not null and lower(c.email) = v_email then 0 else 1 end,
      c.created_at
    limit 1;

    v_duplicate_review_required := v_duplicate_candidate_id is not null;

    insert into public.customers (
      organization_id,
      first_name,
      last_name,
      email,
      phone,
      lead_source,
      preferred_contact,
      sms_consent_at,
      sms_consent_source
    ) values (
      v_org_id,
      v_first_name,
      v_last_name,
      v_email,
      v_phone,
      'website',
      v_preferred_contact,
      case when v_sms_consent then now() else null end,
      case when v_sms_consent then 'website_quote' else null end
    )
    returning id into v_customer_id;

    v_customer_created := true;
  else
    -- Reusing a strong match must never overwrite conflicting identity data.
    update public.customers
    set
      email = coalesce(email, v_email),
      phone = coalesce(nullif(phone, ''), v_phone),
      preferred_contact = v_preferred_contact,
      sms_consent_at = case
        when v_sms_consent and sms_consent_at is null then now()
        else sms_consent_at
      end,
      sms_opt_out_at = case
        when v_sms_consent then null
        else sms_opt_out_at
      end,
      sms_consent_source = case
        when v_sms_consent then 'website_quote'
        else sms_consent_source
      end,
      updated_at = now()
    where id = v_customer_id
      and organization_id = v_org_id;
  end if;

  select p.id
  into v_property_id
  from public.properties p
  where p.organization_id = v_org_id
    and p.customer_id = v_customer_id
    and p.archived_at is null
    and regexp_replace(lower(btrim(p.address_line1)), '\s+', ' ', 'g') = v_address_key
    and regexp_replace(lower(btrim(p.city)), '\s+', ' ', 'g') = v_city_key
    and upper(p.state) = v_state
    and (p.postal_code = v_postal_code or p.postal_code is null)
  order by p.created_at
  limit 1;

  if v_property_id is null then
    insert into public.properties (
      organization_id,
      customer_id,
      label,
      address_line1,
      city,
      state,
      postal_code,
      is_primary
    )
    select
      v_org_id,
      v_customer_id,
      case
        when not exists (
          select 1
          from public.properties existing
          where existing.organization_id = v_org_id
            and existing.customer_id = v_customer_id
            and existing.archived_at is null
        ) then 'Primary'
        else 'Service Property'
      end,
      v_address_line1,
      v_city,
      v_state,
      v_postal_code,
      not exists (
        select 1
        from public.properties existing
        where existing.organization_id = v_org_id
          and existing.customer_id = v_customer_id
          and existing.archived_at is null
      )
    returning id into v_property_id;

    v_property_created := true;
  else
    update public.properties
    set
      postal_code = coalesce(postal_code, v_postal_code),
      updated_at = now()
    where id = v_property_id;
  end if;

  insert into public.leads (
    organization_id,
    customer_id,
    property_id,
    source,
    status,
    requested_service,
    project_details,
    service_address_line1,
    service_city,
    service_state,
    service_postal_code,
    requested_package,
    sms_consent,
    submitted_name,
    submitted_email,
    submitted_phone,
    submitted_at,
    source_page,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    gclid,
    fbclid,
    duplicate_review_required,
    duplicate_candidate_customer_id,
    duplicate_reason,
    external_id
  ) values (
    v_org_id,
    v_customer_id,
    v_property_id,
    'website',
    'new',
    v_service,
    v_message,
    v_address_line1,
    v_city,
    v_state,
    v_postal_code,
    v_package,
    v_sms_consent,
    v_name,
    v_email,
    v_phone,
    v_submitted_at,
    v_landing_page,
    v_referrer,
    v_utm_source,
    v_utm_medium,
    v_utm_campaign,
    v_utm_content,
    v_utm_term,
    v_gclid,
    v_fbclid,
    v_duplicate_review_required,
    v_duplicate_candidate_id,
    v_duplicate_reason,
    v_request_id
  )
  returning id into v_lead_id;

  if v_customer_created then
    insert into public.activity_events (
      organization_id, actor_type, customer_id, entity_type, entity_id, event_type, summary, metadata
    ) values (
      v_org_id,
      'customer',
      v_customer_id,
      'customer',
      v_customer_id,
      'customer.created',
      'Customer created from website request',
      jsonb_build_object('source', 'website')
    );
  end if;

  if v_property_created then
    insert into public.activity_events (
      organization_id, actor_type, customer_id, entity_type, entity_id, event_type, summary, metadata
    ) values (
      v_org_id,
      'customer',
      v_customer_id,
      'property',
      v_property_id,
      'property.created',
      'Service property created from website request',
      jsonb_build_object('city', v_city, 'state', v_state)
    );
  end if;

  insert into public.activity_events (
    organization_id, actor_type, customer_id, entity_type, entity_id, event_type, summary, metadata
  ) values (
    v_org_id,
    'customer',
    v_customer_id,
    'lead',
    v_lead_id,
    'lead.created',
    'Website quote request received',
    jsonb_build_object(
      'service', v_service,
      'city', v_city,
      'requestedPackage', v_package,
      'landingPage', v_landing_page,
      'referrer', v_referrer,
      'utmSource', v_utm_source,
      'utmCampaign', v_utm_campaign,
      'duplicateReviewRequired', v_duplicate_review_required
    )
  );

  insert into public.tasks (
    organization_id,
    customer_id,
    lead_id,
    title,
    description,
    status,
    priority,
    due_at
  ) values (
    v_org_id,
    v_customer_id,
    v_lead_id,
    case
      when v_duplicate_review_required then 'Review possible duplicate website lead'
      else 'Review new website quote request'
    end,
    case
      when v_duplicate_review_required then 'A matching email or phone exists on another customer. Review before merging records.'
      else 'Review the new request and make first contact.'
    end,
    'open',
    case when v_duplicate_review_required then 'high' else 'normal' end,
    now()
  )
  returning id into v_task_id;

  insert into public.activity_events (
    organization_id, actor_type, customer_id, entity_type, entity_id, event_type, summary, metadata
  ) values (
    v_org_id,
    'system',
    v_customer_id,
    'lead',
    v_lead_id,
    'task.created',
    'Lead follow-up task created',
    jsonb_build_object('taskId', v_task_id)
  );

  insert into public.automation_events (
    organization_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    status,
    dedupe_key
  ) values (
    v_org_id,
    'lead.created',
    'lead',
    v_lead_id,
    jsonb_build_object(
      'eventType', 'lead.created',
      'contractVersion', 1,
      'leadId', v_lead_id,
      'customerId', v_customer_id,
      'propertyId', v_property_id,
      'name', v_name,
      'phone', v_phone,
      'email', coalesce(v_email, ''),
      'addressLine1', v_address_line1,
      'city', v_city,
      'state', v_state,
      'postalCode', v_postal_code,
      'smsConsent', v_sms_consent,
      'service', v_service,
      'message', v_message,
      'package', coalesce(v_package, ''),
      'leadSource', 'Website',
      'landingPage', coalesce(v_landing_page, ''),
      'pageUrl', coalesce(v_landing_page, ''),
      'referrer', coalesce(v_referrer, ''),
      'utmSource', coalesce(v_utm_source, ''),
      'utmMedium', coalesce(v_utm_medium, ''),
      'utmCampaign', coalesce(v_utm_campaign, ''),
      'utmContent', coalesce(v_utm_content, ''),
      'utmTerm', coalesce(v_utm_term, ''),
      'gclid', coalesce(v_gclid, ''),
      'fbclid', coalesce(v_fbclid, ''),
      'submittedAt', v_submitted_at,
      'requestId', v_request_id,
      'duplicateReviewRequired', v_duplicate_review_required
    ),
    'pending',
    'lead.created:' || v_lead_id
  )
  returning id into v_automation_event_id;

  return jsonb_build_object(
    'ok', true,
    'leadId', v_lead_id,
    'customerId', v_customer_id,
    'propertyId', v_property_id,
    'taskId', v_task_id,
    'automationEventId', v_automation_event_id,
    'duplicate', false,
    'duplicateReviewRequired', v_duplicate_review_required,
    'duplicateCandidateCustomerId', v_duplicate_candidate_id
  );
end
$function$;

revoke all on function public.intake_website_lead(jsonb) from public;
revoke all on function public.intake_website_lead(jsonb) from anon;
revoke all on function public.intake_website_lead(jsonb) from authenticated;
grant execute on function public.intake_website_lead(jsonb) to service_role;
