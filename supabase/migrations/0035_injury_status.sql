-- Injury / sub-out: a simple, group-visible availability status.
-- Locked rules (docs/product-decisions.md → Injury and sub-out):
--   * no medical details stored — just a status and dates
--   * stops push reminders (reuses notification_preferences.injury_paused)
--   * pauses training-plan progression (plan_status = 'paused_injury')
--   * does NOT break the streak — injured days are protected, not counted
--   * ramp-back mode on return (plan_status = 'ramp_back' for ~2 weeks)
--   * logging is still allowed while injured
--
-- Modeled as episodes (not a single flag) so a streak stays protected across a
-- past injury window even after the member returns.

CREATE TYPE member_availability AS ENUM ('active', 'injured', 'sub_out');

CREATE TABLE public.injury_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  -- Only the away states are stored; 'active' is the absence of an ongoing row.
  status member_availability NOT NULL CHECK (status IN ('injured', 'sub_out')),
  since date NOT NULL,
  ended date,
  expected_return date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended IS NULL OR ended >= since)
);

CREATE INDEX injury_episodes_user_idx ON public.injury_episodes (user_id, since DESC);
-- At most one ongoing (not-yet-ended) episode per user.
CREATE UNIQUE INDEX injury_episodes_one_ongoing
  ON public.injury_episodes (user_id)
  WHERE ended IS NULL;

CREATE TRIGGER injury_episodes_set_updated_at
  BEFORE UPDATE ON public.injury_episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.injury_episodes ENABLE ROW LEVEL SECURITY;

-- Readable by the owner and by anyone who shares an active group (group-visible
-- status). Writes go through SECURITY DEFINER RPCs only.
CREATE POLICY injury_episodes_select_self_or_group
  ON public.injury_episodes FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.group_members me
      JOIN public.group_members them
        ON them.group_id = me.group_id
      WHERE me.user_id = auth.uid() AND me.status = 'active'
        AND them.user_id = public.injury_episodes.user_id AND them.status = 'active'
    )
  );

GRANT SELECT ON public.injury_episodes TO authenticated;

-- === Current status helper ==================================================

CREATE OR REPLACE FUNCTION public.current_availability(p_user_id uuid)
RETURNS public.member_availability
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.injury_episodes
     WHERE user_id = p_user_id AND ended IS NULL
     ORDER BY since DESC LIMIT 1),
    'active'
  );
$$;

-- === Set / clear availability ===============================================

-- Go injured or sub-out: opens (or updates) an ongoing episode, pauses
-- reminders, and pauses training-plan progression across the user's plans.
CREATE OR REPLACE FUNCTION public.set_availability(
  p_status public.member_availability,
  p_expected_return date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status = 'active' THEN
    PERFORM public.end_injury(true);
    RETURN;
  END IF;

  INSERT INTO public.injury_episodes (user_id, status, since, expected_return)
  VALUES (caller, p_status, today, p_expected_return)
  ON CONFLICT (user_id) WHERE ended IS NULL
  DO UPDATE SET status = EXCLUDED.status,
               expected_return = EXCLUDED.expected_return,
               updated_at = now();

  -- Stop reminders (the reminders eligibility already respects this flag).
  UPDATE public.notification_preferences
  SET injury_paused = true, injury_paused_until = NULL
  WHERE user_id = caller;

  -- Pause progression on the member's active plans.
  UPDATE public.user_training_plans
  SET plan_status = 'paused_injury', updated_at = now()
  WHERE user_id = caller AND plan_status <> 'paused_injury';
END;
$$;

-- Return from injury. p_ramp_back = true drops the plan into ramp-back mode for
-- two weeks; false resumes at full targets immediately.
CREATE OR REPLACE FUNCTION public.end_injury(p_ramp_back boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.injury_episodes
  SET ended = today, updated_at = now()
  WHERE user_id = caller AND ended IS NULL;

  UPDATE public.notification_preferences
  SET injury_paused = false, injury_paused_until = NULL
  WHERE user_id = caller;

  UPDATE public.user_training_plans
  SET plan_status = CASE WHEN p_ramp_back THEN 'ramp_back' ELSE 'active' END::public.plan_status,
      -- ramp_back_week doubles as "ramp-back active" marker; the client reads
      -- the two-week window from the episode's end date.
      ramp_back_week = CASE WHEN p_ramp_back THEN 1 ELSE 0 END,
      updated_at = now()
  WHERE user_id = caller AND plan_status = 'paused_injury';
END;
$$;

-- === Group visibility =======================================================

-- Away members (injured / sub-out) in a group, for a status chip on the member
-- list. Only non-active statuses are returned.
CREATE OR REPLACE FUNCTION public.group_availability_statuses(p_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT public.is_group_member(p_group_id, 'active') THEN '[]'::jsonb
    ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', e.user_id,
        'status', e.status,
        'since', e.since,
        'expected_return', e.expected_return
      ))
      FROM public.injury_episodes e
      JOIN public.group_members gm
        ON gm.user_id = e.user_id AND gm.group_id = p_group_id AND gm.status = 'active'
      WHERE e.ended IS NULL
    ), '[]'::jsonb)
  END;
$$;

-- Leave ramp-back mode and resume full training targets. User-controlled so no
-- cron is needed to expire the ramp window.
CREATE OR REPLACE FUNCTION public.resume_full_plan()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  UPDATE public.user_training_plans
  SET plan_status = 'active', ramp_back_week = 0, updated_at = now()
  WHERE user_id = caller AND plan_status = 'ramp_back';
END;
$$;

-- The caller's own current episode (for the Settings control + weekly check-in).
CREATE OR REPLACE FUNCTION public.my_injury_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
       'status', status,
       'since', since,
       'expected_return', expected_return
     )
     FROM public.injury_episodes
     WHERE user_id = auth.uid() AND ended IS NULL
     ORDER BY since DESC LIMIT 1),
    jsonb_build_object('status', 'active')
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_availability(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_availability(public.member_availability, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_injury(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_availability_statuses(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_injury_status() TO authenticated;

-- === Streak protection ======================================================
-- Injured days must not break the active streak. Extend the streak walker to
-- skip any date inside an injury episode window [since, coalesce(ended, as_of)].

CREATE OR REPLACE FUNCTION public.compute_active_streak_days(
  p_user_id uuid,
  p_group_id uuid,
  p_as_of date
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rest_dows integer[];
  freeze_dates date[];
  logged_dates date[];
  streak integer := 0;
  started boolean := false;
  d date;
BEGIN
  SELECT COALESCE(array_agg(day_of_week), '{}')
    INTO rest_dows
    FROM public.group_rest_days
    WHERE group_id = p_group_id AND day_type = 'rest';

  SELECT COALESCE(array_agg(used_on), '{}')
    INTO freeze_dates
    FROM public.streak_freezes
    WHERE group_id = p_group_id AND user_id = p_user_id AND used_on IS NOT NULL;

  SELECT COALESCE(array_agg(DISTINCT logged_for), '{}')
    INTO logged_dates
    FROM public.pushup_entries
    WHERE user_id = p_user_id
      AND group_id = p_group_id
      AND logged_for BETWEEN p_as_of - 400 AND p_as_of
      AND deleted_at IS NULL
      AND review_status IN ('none', 'approved');

  FOR i IN 0..399 LOOP
    d := p_as_of - i;

    IF d = ANY (logged_dates) THEN
      streak := streak + 1;
      started := true;
      CONTINUE;
    END IF;

    IF EXTRACT(dow FROM d)::integer = ANY (rest_dows) OR d = ANY (freeze_dates) THEN
      CONTINUE;
    END IF;

    -- Injury window: protected, does not break the streak.
    IF EXISTS (
      SELECT 1 FROM public.injury_episodes e
      WHERE e.user_id = p_user_id
        AND d >= e.since
        AND d <= COALESCE(e.ended, p_as_of)
    ) THEN
      CONTINUE;
    END IF;

    IF started OR i > 0 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN streak;
END;
$$;
