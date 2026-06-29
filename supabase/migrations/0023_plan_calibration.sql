-- Plan calibration from recent log volume

ALTER TABLE public.user_training_plans
  ADD COLUMN IF NOT EXISTS recent_daily_average smallint
    CHECK (recent_daily_average IS NULL OR recent_daily_average >= 0),
  ADD COLUMN IF NOT EXISTS calibration_note text;

COMMENT ON COLUMN public.user_training_plans.recent_daily_average IS
  'User-confirmed recent daily rep average at wizard save (optional calibration input).';
COMMENT ON COLUMN public.user_training_plans.calibration_note IS
  'Plain-language note explaining initial plan baseline / mesocycle start calibration.';

CREATE OR REPLACE FUNCTION public.user_volume_stats(
  p_group_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_days integer DEFAULT 28
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_target_user uuid := COALESCE(p_user_id, v_uid);
  v_days integer := GREATEST(COALESCE(p_days, 28), 1);
  v_start date;
  v_today date;
  v_sample_days integer;
  v_avg_daily numeric;
  v_peak_daily integer;
  v_peak_bank integer;
  v_estimated_max integer;
BEGIN
  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF v_target_user <> v_uid AND NOT public.is_group_admin(p_group_id) THEN
    RAISE EXCEPTION 'Not allowed to read volume stats for this user';
  END IF;

  v_today := public.group_local_date(p_group_id);
  v_start := v_today - (v_days - 1);

  WITH daily AS (
    SELECT
      pe.logged_for,
      sum(pe.count)::integer AS day_total
    FROM public.pushup_entries pe
    WHERE pe.group_id = p_group_id
      AND pe.user_id = v_target_user
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_today
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.logged_for
  ),
  banks AS (
    SELECT max(pe.count)::integer AS peak_bank
    FROM public.pushup_entries pe
    WHERE pe.group_id = p_group_id
      AND pe.user_id = v_target_user
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_today
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
  ),
  rir AS (
    SELECT max(pe.count + pe.reps_in_reserve)::integer AS estimated_max_clean
    FROM public.pushup_entries pe
    WHERE pe.group_id = p_group_id
      AND pe.user_id = v_target_user
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_today
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
      AND pe.reps_in_reserve IS NOT NULL
  )
  SELECT
    count(*)::integer,
    COALESCE(avg(day_total), 0),
    COALESCE(max(day_total), 0),
    COALESCE((SELECT peak_bank FROM banks), 0),
    (SELECT estimated_max_clean FROM rir)
  INTO
    v_sample_days,
    v_avg_daily,
    v_peak_daily,
    v_peak_bank,
    v_estimated_max
  FROM daily;

  RETURN jsonb_build_object(
    'sample_days', COALESCE(v_sample_days, 0),
    'avg_daily_total', COALESCE(v_avg_daily, 0),
    'peak_daily_total', COALESCE(v_peak_daily, 0),
    'peak_bank', COALESCE(v_peak_bank, 0),
    'estimated_max_clean', v_estimated_max
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_volume_stats(uuid, uuid, integer) TO authenticated;
