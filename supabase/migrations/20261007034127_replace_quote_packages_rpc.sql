create or replace function public.replace_quote_packages(
  p_quote_id uuid,
  p_organization_id uuid,
  p_packages jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_quote public.quotes%rowtype;
  v_package jsonb;
  v_item jsonb;
  v_package_id uuid;
  v_selected_package_id uuid := null;
  v_first_package_id uuid := null;
  v_package_count integer := 0;
  v_recommended_count integer := 0;
begin
  select * into v_quote
  from public.quotes
  where id = p_quote_id
    and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Quote not found';
  end if;

  if v_quote.status in ('approved','declined','expired','cancelled') then
    raise exception 'This quote can no longer be edited';
  end if;

  if p_packages is null or jsonb_typeof(p_packages) <> 'array' then
    p_packages := '[]'::jsonb;
  end if;

  v_package_count := jsonb_array_length(p_packages);
  if v_package_count not in (0,2,3,4) then
    raise exception 'Package quotes require 2 to 4 packages';
  end if;

  update public.quotes
  set selected_package_id = null
  where id = p_quote_id;

  delete from public.quote_packages
  where quote_id = p_quote_id
    and organization_id = p_organization_id;

  for v_package in select value from jsonb_array_elements(p_packages)
  loop
    if coalesce(nullif(trim(v_package->>'name'),''),'') = '' then
      raise exception 'Every package needs a name';
    end if;

    if coalesce(v_package->>'tier','custom') not in ('good','better','best','custom') then
      raise exception 'Invalid package tier';
    end if;

    if jsonb_typeof(coalesce(v_package->'items','[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_package->'items','[]'::jsonb)) = 0 then
      raise exception 'Every package needs at least one line item';
    end if;

    insert into public.quote_packages (
      organization_id, quote_id, name, tier, description, is_recommended, sort_order
    ) values (
      p_organization_id,
      p_quote_id,
      left(trim(v_package->>'name'),200),
      coalesce(v_package->>'tier','custom'),
      nullif(left(trim(coalesce(v_package->>'description','')),1200),''),
      coalesce((v_package->>'isRecommended')::boolean,false),
      coalesce((v_package->>'sortOrder')::integer, v_recommended_count * 10)
    ) returning id into v_package_id;

    if v_first_package_id is null then
      v_first_package_id := v_package_id;
    end if;

    if coalesce((v_package->>'isRecommended')::boolean,false) then
      v_recommended_count := v_recommended_count + 1;
      if v_recommended_count > 1 then
        raise exception 'Only one package can be recommended';
      end if;
      v_selected_package_id := v_package_id;
    end if;

    for v_item in select value from jsonb_array_elements(v_package->'items')
    loop
      if coalesce(nullif(trim(v_item->>'name'),''),'') = '' then
        raise exception 'Every package line item needs a name';
      end if;

      insert into public.quote_items (
        quote_id, service_id, package_id, name, description, quantity, unit_price,
        optional, selected, sort_order
      ) values (
        p_quote_id,
        nullif(v_item->>'serviceId','')::uuid,
        v_package_id,
        left(trim(v_item->>'name'),200),
        nullif(left(trim(coalesce(v_item->>'description','')),1200),''),
        greatest(coalesce((v_item->>'quantity')::numeric,1),0.001),
        greatest(coalesce((v_item->>'unitPrice')::numeric,0),0),
        false,
        true,
        coalesce((v_item->>'sortOrder')::integer,0)
      );
    end loop;
  end loop;

  if v_package_count > 0 then
    v_selected_package_id := coalesce(v_selected_package_id, v_first_package_id);
    update public.quotes
    set selected_package_id = v_selected_package_id
    where id = p_quote_id;
  end if;

  perform public.recalculate_quote_totals(p_quote_id);
  return v_selected_package_id;
end;
$function$;

revoke all on function public.replace_quote_packages(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.replace_quote_packages(uuid,uuid,jsonb) to service_role;
