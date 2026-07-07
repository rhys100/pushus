-- Custom reminder intervals in minutes: 30m, 1h, 2h, 3h, 4h, once daily.
-- The legacy reminder_interval_hours column (1 | 2 | 24) stays for older cached
-- PWA clients; a sync trigger keeps both columns coherent whichever side writes.
-- Drop the legacy column in a later migration once old bundles have aged out.

ALTER TABLE public.notification_preferences
  ADD COLUMN reminder_interval_minutes integer NOT NULL DEFAULT 60
    CHECK (reminder_interval_minutes IN (30, 60, 120, 180, 240, 1440));

UPDATE public.notification_preferences
SET reminder_interval_minutes = reminder_interval_hours * 60;

-- Nearest legacy bucket for a minutes interval (legacy check allows 1, 2, 24).
CREATE OR REPLACE FUNCTION public.reminder_interval_bucket_hours(minutes integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN minutes >= 1440 THEN 24
    WHEN minutes >= 120 THEN 2
    ELSE 1
  END::smallint;
$$;

CREATE OR REPLACE FUNCTION public.sync_reminder_interval_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.reminder_interval_minutes IS DISTINCT FROM OLD.reminder_interval_minutes THEN
      NEW.reminder_interval_hours :=
        public.reminder_interval_bucket_hours(NEW.reminder_interval_minutes);
    ELSIF NEW.reminder_interval_hours IS DISTINCT FROM OLD.reminder_interval_hours THEN
      NEW.reminder_interval_minutes := NEW.reminder_interval_hours * 60;
    END IF;
  ELSE
    -- INSERT: legacy clients send hours and leave minutes at its default (60);
    -- new clients send a coherent pair. When the pair disagrees and minutes
    -- looks untouched, trust hours; otherwise minutes is the source of truth.
    IF NEW.reminder_interval_minutes = 60
       AND NEW.reminder_interval_hours * 60 <> NEW.reminder_interval_minutes THEN
      NEW.reminder_interval_minutes := NEW.reminder_interval_hours * 60;
    ELSE
      NEW.reminder_interval_hours :=
        public.reminder_interval_bucket_hours(NEW.reminder_interval_minutes);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_preferences_sync_interval
  ON public.notification_preferences;

CREATE TRIGGER notification_preferences_sync_interval
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reminder_interval_columns();
