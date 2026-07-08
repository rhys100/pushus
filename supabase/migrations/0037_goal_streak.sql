-- Goal streak: consecutive days the member hit their daily goal.
-- The "goal" is notification_preferences.daily_target — the same daily goal the
-- reminders treat as "behind" — so the streak and the reminders agree on what
-- counts as done. Rest days, streak freezes, and injury windows are protected
-- (mirrors compute_active_streak_days from 0031/0035). Today doesn't break it
-- (the day isn't over). Members with no daily_target get a 0 goal streak.

CREATE OR REPLACE FUNCTION public.compute_goal_streak_days(
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
  daily_target integer;
  day_total integer;
  streak integer := 0;
  started boolean := false;
  d date;
BEGIN
  SELECT np.daily_target INTO daily_target
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;

  IF daily_target IS NULL OR daily_target <= 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(array_agg(day_of_week), '{}')
    INTO rest_dows
    FROM public.group_rest_days
    WHERE group_id = p_group_id AND day_type = 'rest';

  SELECT COALESCE(array_agg(used_on), '{}')
    INTO freeze_dates
    FROM public.streak_freezes
    WHERE group_id = p_group_id AND user_id = p_user_id AND used_on IS NOT NULL;

  FOR i IN 0..399 LOOP
    d := p_as_of - i;

    SELECT COALESCE(sum(count), 0) INTO day_total
    FROM public.pushup_entries
    WHERE user_id = p_user_id AND group_id = p_group_id AND logged_for = d
      AND deleted_at IS NULL AND review_status IN ('none', 'approved');

    IF day_total >= daily_target THEN
      streak := streak + 1;
      started := true;
      CONTINUE;
    END IF;

    -- Protected days never break the streak; freezes and injury cover a gap too.
    IF EXTRACT(dow FROM d)::integer = ANY (rest_dows) OR d = ANY (freeze_dates) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.injury_episodes e
      WHERE e.user_id = p_user_id
        AND d >= e.since
        AND d <= COALESCE(e.ended, p_as_of)
    ) THEN
      CONTINUE;
    END IF;

    -- Today (i = 0) not yet at goal doesn't break the run.
    IF started OR i > 0 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN streak;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_streaks(p_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'active', public.compute_active_streak_days(auth.uid(), p_group_id, public.group_local_date(p_group_id)),
    'goal', public.compute_goal_streak_days(auth.uid(), p_group_id, public.group_local_date(p_group_id))
  );
$$;

GRANT EXECUTE ON FUNCTION public.compute_goal_streak_days(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_streaks(uuid) TO authenticated;
