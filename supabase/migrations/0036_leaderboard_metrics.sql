-- More leaderboard types: biggest set and most improved, alongside total reps.
-- Same shape as leaderboard_total (0029) so the client renders rows identically;
-- the `total` column carries the selected metric's value (can be negative for
-- most_improved). Goal-completion is handled on the client day view (per-member
-- % of daily target) and isn't a period metric here.

CREATE OR REPLACE FUNCTION public.leaderboard_metric(
  p_group_id uuid,
  p_metric text DEFAULT 'total',
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_emoji text,
  avatar_color text,
  total integer,
  rank bigint,
  show_rep_totals boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_start date;
  v_end date;
  v_prev_start date;
  v_prev_end date;
  v_span integer;
BEGIN
  PERFORM public.assert_authenticated();

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF p_metric NOT IN ('total', 'biggest_set', 'most_improved') THEN
    RAISE EXCEPTION 'Unknown leaderboard metric: %', p_metric;
  END IF;

  v_today := public.group_local_date(p_group_id);
  v_end := COALESCE(p_period_end, v_today);
  v_start := COALESCE(p_period_start, date_trunc('week', v_today::timestamp)::date);

  -- Previous equal-length window immediately before the current one.
  v_span := (v_end - v_start);
  v_prev_end := v_start - 1;
  v_prev_start := v_prev_end - v_span;

  RETURN QUERY
  WITH metric AS (
    SELECT
      pe.user_id,
      CASE
        WHEN p_metric = 'biggest_set' THEN COALESCE(max(pe.count), 0)
        ELSE COALESCE(sum(pe.count), 0)
      END::integer AS value
    FROM public.pushup_entries pe
    WHERE pe.group_id = p_group_id
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_end
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.user_id
  ),
  prev AS (
    SELECT
      pe.user_id,
      COALESCE(sum(pe.count), 0)::integer AS value
    FROM public.pushup_entries pe
    WHERE p_metric = 'most_improved'
      AND pe.group_id = p_group_id
      AND pe.logged_for >= v_prev_start
      AND pe.logged_for <= v_prev_end
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.user_id
  ),
  scored AS (
    SELECT
      gm.user_id,
      CASE
        WHEN p_metric = 'most_improved'
          THEN COALESCE(m.value, 0) - COALESCE(pr.value, 0)
        ELSE COALESCE(m.value, 0)
      END AS value
    FROM public.group_members gm
    LEFT JOIN metric m ON m.user_id = gm.user_id
    LEFT JOIN prev pr ON pr.user_id = gm.user_id
    WHERE gm.group_id = p_group_id AND gm.status = 'active'
  )
  SELECT
    p.id AS user_id,
    p.display_name,
    p.avatar_emoji,
    p.avatar_color,
    s.value AS total,
    dense_rank() OVER (ORDER BY s.value DESC, p.display_name ASC) AS rank,
    p.show_rep_totals
  FROM scored s
  JOIN public.profiles p ON p.id = s.user_id
  ORDER BY rank ASC, p.display_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_metric(uuid, text, date, date) TO authenticated;
