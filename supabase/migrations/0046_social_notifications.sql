-- Social push notifications: tell members when someone requests them as a mate,
-- accepts their request, invites them to a 1v1 challenge, or reacts to their
-- entries. Delivery is the send-social edge function (mirrors send-nudge). This
-- migration adds the opt-out preference and a small delivery log used to
-- debounce high-frequency reaction pushes.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS social_push_enabled boolean NOT NULL DEFAULT true;

-- Coarse per-recipient debounce so five reactions don't mean five buzzes.
-- Written and read only by the edge function (service role); no client access.
CREATE TABLE IF NOT EXISTS public.social_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_push_log_user_kind_time_idx
  ON public.social_push_log (user_id, kind, created_at DESC);

-- RLS on with no policies => denied to all authenticated users. The edge
-- function uses the service role, which bypasses RLS.
ALTER TABLE public.social_push_log ENABLE ROW LEVEL SECURITY;
