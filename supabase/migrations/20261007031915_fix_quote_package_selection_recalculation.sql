create or replace function public.quote_selection_recalculate_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $$
begin
  perform public.recalculate_quote_totals(new.id);
  return new;
end;
$$;

drop trigger if exists quotes_recalculate_after_package_selection on public.quotes;
create trigger quotes_recalculate_after_package_selection
after update of selected_package_id on public.quotes
for each row
when (old.selected_package_id is distinct from new.selected_package_id)
execute function public.quote_selection_recalculate_trigger();