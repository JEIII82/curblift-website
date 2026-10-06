revoke all on function public.get_due_quote_follow_ups(integer) from public, anon, authenticated;
revoke all on function public.complete_quote_follow_up_step(uuid) from public, anon, authenticated;
grant execute on function public.get_due_quote_follow_ups(integer) to service_role;
grant execute on function public.complete_quote_follow_up_step(uuid) to service_role;
