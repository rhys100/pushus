-- Customisable reminder frequency (hourly, every 2 hours, once daily).
-- New users default to hourly reminders between 7am and 7pm.
-- Existing users keep once-daily until they change frequency in Settings.

ALTER TABLE public.notification_preferences
  ADD COLUMN reminder_interval_hours smallint NOT NULL DEFAULT 1
    CHECK (reminder_interval_hours IN (1, 2, 24));

UPDATE public.notification_preferences
SET reminder_interval_hours = 24
WHERE reminder_interval_hours = 1;

ALTER TABLE public.notification_preferences
  ALTER COLUMN active_hours_start SET DEFAULT 7,
  ALTER COLUMN active_hours_end SET DEFAULT 20;
