-- Schedule send-push-reminders from inside Supabase using pg_cron + pg_net.
--
-- Why: GitHub Actions cron fires with tens of minutes of jitter and pauses
-- entirely after 60 days of repo inactivity, which made "hourly" reminders
-- skip hours. pg_cron ticks reliably every 15 minutes; the edge function's
-- per-user interval check decides who actually gets a reminder.
--
-- This is a snippet, not a migration, because the project URL and secret are
-- deployment-specific. Run it once in the Supabase SQL editor:
--
--   1. Store your CRON_SECRET in Vault (must match the edge function secret):
--        select vault.create_secret('<your CRON_SECRET>', 'push_reminders_cron_secret');
--   2. Replace <project-ref> below with your Supabase project ref.
--   3. Run this whole file.
--
-- After confirming reminders arrive, disable the GitHub Actions fallback
-- workflow (.github/workflows/push-reminders-cron.yml) to avoid double ticks.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $do$
begin
  if exists (select 1 from cron.job where jobname = 'send-push-reminders') then
    perform cron.unschedule('send-push-reminders');
  end if;
end
$do$;

select cron.schedule(
  'send-push-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-push-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'push_reminders_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

-- Verify: the job should appear here, and runs land in cron.job_run_details.
select jobid, jobname, schedule, active from cron.job where jobname = 'send-push-reminders';
