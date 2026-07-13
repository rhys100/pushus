-- Mate scoring correctness fixes (production-readiness 2026-07-13).
--
-- P1.3: get_mate_stats anchored every window on the *target* user's timezone,
--       and MatesPage calls it once per side — so "You vs mate" could compare
--       your local "today" against their local "today". Anchor both sides on
--       the *caller* (viewer) timezone so the comparison is apples-to-apples.
--       Signature is unchanged, so no client change is required.
--
-- P1.2: list_mate_challenges summed reps by insert timestamp (logged_at). With
--       back-dated logging (0041) a rep logged "for" an in-window day but banked
--       after the battle ended did not count, while a rep logged during the
--       battle "for yesterday" did. Group challenges score on logged_for; make
--       1v1 battles consistent by windowing on logged_for over the battle's
--       inclusive date range, anchored on the challenger's timezone (fixed per
--       battle, so both participants see the same result — there is no shared
--       group timezone for a 1v1).

-- === P1.3: get_mate_stats on the viewer's timezone ==========================

CREATE OR REPLACE FUNCTION public.get_mate_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  tz text;
  today date;
  result jsonb;
BEGIN
  IF p_user_id <> caller AND NOT public.are_mates(caller, p_user_id) THEN
    RAISE EXCEPTION 'Not connected';
  END IF;

  -- Anchor the windows on the *viewer's* timezone (not the target's) so the two
  -- calls MatesPage makes (self + mate) line up on the same local day.
  SELECT COALESCE(NULLIF(timezone, ''), 'UTC') INTO tz FROM public.profiles WHERE id = caller;
  today := (now() AT TIME ZONE COALESCE(tz, 'UTC'))::date;

  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'today_total', COALESCE(SUM(count) FILTER (WHERE logged_for = today), 0),
    'seven_day_total', COALESCE(SUM(count) FILTER (WHERE logged_for > today - 7), 0),
    'thirty_day_total', COALESCE(SUM(count) FILTER (WHERE logged_for > today - 30), 0),
    'best_day_30', COALESCE((
      SELECT MAX(day_total) FROM (
        SELECT SUM(count) AS day_total
        FROM public.pushup_entries
        WHERE user_id = p_user_id AND logged_for > today - 30
          AND deleted_at IS NULL AND review_status IN ('none', 'approved')
        GROUP BY logged_for
      ) days
    ), 0)
  ) INTO result
  FROM public.pushup_entries
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND review_status IN ('none', 'approved');

  RETURN result;
END;
$$;

-- === P1.2: list_mate_challenges windows on logged_for =======================

CREATE OR REPLACE FUNCTION public.list_mate_challenges()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH battles AS (
    SELECT
      mc.id,
      mc.status,
      mc.duration_days,
      mc.starts_at,
      mc.ends_at,
      mc.created_at,
      mc.challenger_id,
      other.id AS other_id,
      other.display_name AS other_display_name,
      other.name_initial AS other_name_initial,
      other.avatar_emoji AS other_avatar_emoji,
      -- Inclusive logged_for window, anchored on the challenger's timezone so
      -- both participants see the same numbers. NULL for pending (no starts_at).
      (mc.starts_at AT TIME ZONE COALESCE(NULLIF(chal.timezone, ''), 'UTC'))::date AS win_start,
      (mc.starts_at AT TIME ZONE COALESCE(NULLIF(chal.timezone, ''), 'UTC'))::date
        + (mc.duration_days - 1) AS win_end
    FROM public.mate_challenges mc
    JOIN public.profiles other
      ON other.id = CASE WHEN mc.challenger_id = auth.uid() THEN mc.opponent_id ELSE mc.challenger_id END
    JOIN public.profiles chal ON chal.id = mc.challenger_id
    WHERE (mc.challenger_id = auth.uid() OR mc.opponent_id = auth.uid())
      AND (mc.status IN ('pending', 'active')
        OR mc.updated_at > now() - interval '14 days')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'duration_days', b.duration_days,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'created_at', b.created_at,
    'is_challenger', b.challenger_id = auth.uid(),
    'my_total', COALESCE((
      SELECT SUM(count) FROM public.pushup_entries e
      WHERE e.user_id = auth.uid()
        AND b.starts_at IS NOT NULL
        AND e.logged_for >= b.win_start AND e.logged_for <= b.win_end
        AND e.deleted_at IS NULL AND e.review_status IN ('none', 'approved')
    ), 0),
    'their_total', COALESCE((
      SELECT SUM(count) FROM public.pushup_entries e
      WHERE e.user_id = b.other_id
        AND b.starts_at IS NOT NULL
        AND e.logged_for >= b.win_start AND e.logged_for <= b.win_end
        AND e.deleted_at IS NULL AND e.review_status IN ('none', 'approved')
    ), 0),
    'opponent', jsonb_build_object(
      'id', b.other_id,
      'display_name', b.other_display_name,
      'name_initial', b.other_name_initial,
      'avatar_emoji', b.other_avatar_emoji
    )
  ) ORDER BY b.created_at DESC), '[]'::jsonb)
  FROM battles b;
$$;

GRANT EXECUTE ON FUNCTION public.get_mate_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mate_challenges() TO authenticated;
