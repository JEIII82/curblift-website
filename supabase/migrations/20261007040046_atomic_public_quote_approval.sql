create or replace function public.approve_public_quote(
  p_quote_id uuid,
  p_organization_id uuid,
  p_approval_name text,
  p_package_id uuid default null,
  p_selected_addon_ids jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_quote public.quotes%rowtype;
  v_package_count integer := 0;
  v_selected_package_id uuid := null;
  v_selected_package_name text := null;
  v_job_id uuid := null;
  v_scope text := null;
  v_total numeric(12,2) := 0;
  v_now timestamptz := now();
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
    and organization_id = p_organization_id
  for update;

  if not found then raise exception 'Quote not found'; end if;
  if coalesce(nullif(trim(p_approval_name),''),'') = '' then raise exception 'Enter your name to approve the quote'; end if;

  if v_quote.status = 'approved' then
    select id into v_job_id from public.jobs where quote_id = v_quote.id limit 1;
    select name into v_selected_package_name from public.quote_packages where id = v_quote.selected_package_id;
    return jsonb_build_object('ok',true,'status','approved','jobId',v_job_id,'total',v_quote.total,'selectedPackageId',v_quote.selected_package_id,'selectedPackageName',v_selected_package_name,'alreadyApproved',true);
  end if;

  if v_quote.status in ('declined','expired','cancelled','changes_requested') then
    raise exception 'This quote cannot be approved in its current status';
  end if;
  if v_quote.property_id is null then raise exception 'Service address is missing. Please contact RinsePoint.'; end if;

  select count(*) into v_package_count from public.quote_packages where quote_id=v_quote.id and organization_id=p_organization_id;
  if v_package_count > 0 then
    v_selected_package_id := coalesce(
      p_package_id,
      v_quote.selected_package_id,
      (select id from public.quote_packages where quote_id=v_quote.id and organization_id=p_organization_id and is_recommended order by sort_order limit 1),
      (select id from public.quote_packages where quote_id=v_quote.id and organization_id=p_organization_id order by sort_order limit 1)
    );
    if not exists (select 1 from public.quote_packages where id=v_selected_package_id and quote_id=v_quote.id and organization_id=p_organization_id) then
      raise exception 'Choose one of the available service packages before approving';
    end if;
    update public.quotes set selected_package_id=v_selected_package_id where id=v_quote.id;
    select name into v_selected_package_name from public.quote_packages where id=v_selected_package_id;
  else
    if p_package_id is not null then raise exception 'This quote does not have service packages'; end if;
    v_selected_package_id := null;
  end if;

  if p_selected_addon_ids is not null then
    if jsonb_typeof(p_selected_addon_ids) <> 'array' then raise exception 'Selected add-ons must be an array'; end if;
    if exists (
      select 1 from jsonb_array_elements_text(p_selected_addon_ids) x(value)
      where not exists (
        select 1 from public.quote_items i
        where i.id=x.value::uuid and i.quote_id=v_quote.id and i.package_id is null and i.optional=true
      )
    ) then raise exception 'One or more selected add-ons are not available for this quote'; end if;

    update public.quote_items set selected=false where quote_id=v_quote.id and package_id is null and optional=true;
    if jsonb_array_length(p_selected_addon_ids) > 0 then
      update public.quote_items set selected=true
      where quote_id=v_quote.id and package_id is null and optional=true
        and id in (select value::uuid from jsonb_array_elements_text(p_selected_addon_ids));
    end if;
  end if;

  perform public.recalculate_quote_totals(v_quote.id);
  select total into v_total from public.quotes where id=v_quote.id;

  update public.quotes
  set status='approved', approved_at=v_now, approval_name=left(trim(p_approval_name),160)
  where id=v_quote.id;

  select string_agg(i.name, ', ' order by i.sort_order, i.created_at)
  into v_scope
  from public.quote_items i
  where i.quote_id=v_quote.id
    and ((i.package_id is null and (i.optional=false or i.selected=true)) or (v_selected_package_id is not null and i.package_id=v_selected_package_id));

  select id into v_job_id from public.jobs where quote_id=v_quote.id limit 1;
  if v_job_id is null then
    insert into public.jobs (organization_id,customer_id,property_id,quote_id,lead_id,status,title,scope_of_work,quoted_total,final_total)
    values (v_quote.organization_id,v_quote.customer_id,v_quote.property_id,v_quote.id,v_quote.lead_id,'unscheduled',coalesce(v_selected_package_name,v_quote.title,'Exterior Cleaning'),v_scope,v_total,v_total)
    returning id into v_job_id;
  end if;

  insert into public.activity_events (organization_id,actor_type,customer_id,entity_type,entity_id,event_type,summary,metadata)
  values (
    v_quote.organization_id,'customer',v_quote.customer_id,'quote',v_quote.id,'quote.approved',
    'Quote #' || v_quote.quote_number::text || ' approved by ' || left(trim(p_approval_name),160),
    jsonb_build_object('jobId',v_job_id,'approvalName',left(trim(p_approval_name),160),'selectedPackageId',v_selected_package_id,'selectedPackageName',v_selected_package_name,'selectedAddOnIds',coalesce(p_selected_addon_ids,'[]'::jsonb),'total',v_total)
  );

  insert into public.automation_events (organization_id,event_type,entity_type,entity_id,payload,dedupe_key)
  values (
    v_quote.organization_id,'quote.approved','quote',v_quote.id,
    jsonb_build_object('quoteId',v_quote.id,'quoteNumber',v_quote.quote_number,'jobId',v_job_id,'total',v_total,'approvalName',left(trim(p_approval_name),160),'selectedPackageId',v_selected_package_id,'selectedPackageName',v_selected_package_name),
    'quote.approved:' || v_quote.id::text
  )
  on conflict (organization_id,dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('ok',true,'status','approved','jobId',v_job_id,'total',v_total,'selectedPackageId',v_selected_package_id,'selectedPackageName',v_selected_package_name,'alreadyApproved',false);
end;
$function$;

revoke all on function public.approve_public_quote(uuid,uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.approve_public_quote(uuid,uuid,text,uuid,jsonb) to service_role;
