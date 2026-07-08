-- Batched volume stats for the Day board's per-member targets.
--
-- Replaces the N+1 where the Board called user_volume_stats() once per member.
-- Returns one row per *permitted* user in a single call, with the exact same
-- per-user shape user_volume_stats produces. Permission model is identical to
-- user_volume_stats: the caller always gets their own stats; a group admin
-- also gets every active member's. Non-admins therefore get only their own row
-- (others fall back to null client-side, exactly as before) — no new exposure.

CREATE OR REPLACE FUNCTION public.group_volume_stats(
  p_group_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_is_admin boolean;
  v_days integer := GREATEST(COALESCE(p_days, 30), 1);
  v_today date;
  v_start date;
  v_result jsonb;
BEGIN
  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  v_is_admin := public.is_group_admin(p_group_id);
  v_today := public.group_local_date(p_group_id);
  v_start := v_today - (v_days - 1);

  WITH target_users AS (
    -- The caller always; every active member too when the caller is an admin.
    SELECT gm.user_id
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.status = 'active'
      AND (v_is_admin OR gm.user_id = v_uid)
  ),
  daily AS (
    SELECT pe.user_id, pe.logged_for, sum(pe.count)::integer AS day_total
    FROM public.pushup_entries pe
    JOIN target_users tu ON tu.user_id = pe.user_id
    WHERE pe.group_id = p_group_id
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_today
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.user_id, pe.logged_for
  ),
  per_user_window AS (
    SELECT
      user_id,
      count(*)::integer AS sample_days,
      COALESCE(avg(day_total), 0) AS avg_daily_total,
      COALESCE(max(day_total), 0) AS peak_daily_total
    FROM daily
    GROUP BY user_id
  ),
  per_user_bank AS (
    SELECT
      pe.user_id,
      max(pe.count)::integer AS peak_bank,
      (max(pe.count + pe.reps_in_reserve)
        FILTER (WHERE pe.reps_in_reserve IS NOT NULL))::integer AS estimated_max_clean
    FROM public.pushup_entries pe
    JOIN target_users tu ON tu.user_id = pe.user_id
    WHERE pe.group_id = p_group_id
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_today
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.user_id
  ),
  per_user_last AS (
    -- Last-log is all-time (matches user_volume_stats), not the window.
    SELECT pe.user_id, max(pe.logged_for) AS last_log_date
    FROM public.pushup_entries pe
    JOIN target_users tu ON tu.user_id = pe.user_id
    WHERE pe.group_id = p_group_id
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.user_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', tu.user_id,
      'sample_days', COALESCE(w.sample_days, 0),
      'avg_daily_total', COALESCE(w.avg_daily_total, 0),
      'peak_daily_total', COALESCE(w.peak_daily_total, 0),
      'peak_bank', COALESCE(b.peak_bank, 0),
      'estimated_max_clean', b.estimated_max_clean,
      'last_log_date', l.last_log_date,
      'days_since_last_log',
        CASE WHEN l.last_log_date IS NULL THEN NULL
             ELSE (v_today - l.last_log_date)::integer END
    )
  )
  INTO v_result
  FROM target_users tu
  LEFT JOIN per_user_window w ON w.user_id = tu.user_id
  LEFT JOIN per_user_bank b ON b.user_id = tu.user_id
  LEFT JOIN per_user_last l ON l.user_id = tu.user_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_volume_stats(uuid, integer) TO authenticated;
