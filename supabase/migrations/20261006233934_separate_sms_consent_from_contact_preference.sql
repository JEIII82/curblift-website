do $migration$
declare
  v_def text;
  v_old_default text := $$when v_sms_consent then 'sms'
      when v_email is not null then 'email'
      else 'phone'$$;
  v_new_default text := $$when v_email is not null then 'email'
      else 'phone'$$;
  v_old_update text := $$preferred_contact = v_preferred_contact,$$;
  v_new_update text := $$preferred_contact = case
        when lower(btrim(coalesce(p_payload->>'preferredContact', ''))) in ('email', 'phone', 'sms') then v_preferred_contact
        else preferred_contact
      end,$$;
begin
  select pg_get_functiondef('public.intake_website_lead(jsonb)'::regprocedure)
    into v_def;

  if position(v_old_default in v_def) = 0 then
    raise exception 'Expected consent-first preferred-contact fallback was not found';
  end if;

  if position(v_old_update in v_def) = 0 then
    raise exception 'Expected preferred_contact update assignment was not found';
  end if;

  v_def := replace(v_def, v_old_default, v_new_default);
  v_def := replace(v_def, v_old_update, v_new_update);
  execute v_def;
end
$migration$;
