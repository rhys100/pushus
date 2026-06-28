-- PushUS Phase 3 — web push notifications

-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT false,
  active_hours_start smallint NOT NULL DEFAULT 9 CHECK (active_hours_start >= 0 AND active_hours_start <= 23),
  active_hours_end smallint NOT NULL DEFAULT 20 CHECK (active_hours_end >= 0 AND active_hours_end <= 23),
  daily_target integer NOT NULL DEFAULT 20 CHECK (daily_target > 0),
  injury_paused boolean NOT NULL DEFAULT false,
  injury_paused_until date,
  last_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER notification_preferences_set_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX push_subscriptions_user_id_enabled_idx
  ON public.push_subscriptions (user_id)
  WHERE enabled = true;

CREATE TRIGGER push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notification_events (append-only audit log)
-- ---------------------------------------------------------------------------

CREATE TYPE notification_event_type AS ENUM (
  'reminder_sent',
  'reminder_failed',
  'subscription_disabled'
);

CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.push_subscriptions (id) ON DELETE SET NULL,
  event_type notification_event_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  http_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_events_user_id_created_at_idx
  ON public.notification_events (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Auto-create notification preferences for new profiles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_profile_notification_prefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_notification_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_notification_prefs();

-- Backfill existing profiles
INSERT INTO public.notification_preferences (user_id)
SELECT p.id
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_preferences_select_self
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_preferences_update_self
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_select_self
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert_self
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_update_self
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_self
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_events_select_self
  ON public.notification_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Writes to notification_events are service-role only (edge function cron).

GRANT SELECT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.notification_events TO service_role;
