create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname = 'rinsepoint-quote-followups';

select cron.schedule(
  'rinsepoint-quote-followups',
  '*/15 * * * *',
  $$select public.dispatch_due_quote_followups(25);$$
);
