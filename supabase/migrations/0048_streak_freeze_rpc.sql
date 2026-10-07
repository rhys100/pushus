-- ---------------------------------------------------------------------------
-- 0048: move streak-freeze spending behind a SECURITY DEFINER RPC
--
-- Members could write `streak_freezes` rows directly. `streak_freezes_insert_self`
-- (0004) only checked `user_id = auth.uid()` and active membership, and the
-- client supplied BOTH `week_start` and `used_on`. Nothing server-side tied the
-- two together or bounded the protected date, so from a browser console a member
-- could protect any date, past or future, and mint one row per arbitrary
-- `week_start` value — the UNIQUE (user_id, group_id, week_start) index does not
-- help when the attacker chooses that column too.
--
-- The "one freeze per week" and "yesterday only" rules existed only in client
-- JavaScript (resolveFreezeStatus). This moves them to the database.
--
-- Streak semantics are UNCHANGED: a freeze is still a row with `used_on` set,
-- and neither streak walker (compute_active_streak_days in 0035, or the client
-- computeActiveStreak) is touched. Freezes still never write pushup_entries and
-- never award XP — cosmetic protection only, per docs/product-decisions.md.
--
-- BREAKING COUPLING: dropping the write policies breaks any client still doing
-- a direct insert, so this migration and the matching useStreaks change must
-- ship together.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.use_streak_freeze(p_group_id uuid)
RETURNS public.streak_freezes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_active_group_member(p_group_id);
  v_today date;
  v_protect_date date;
  v_week_start date;
  v_row public.streak_freezes;
BEGIN
  -- Group timezone, never now()::date. A member in a different timezone from
  -- their group must protect the same calendar day the board is scoring.
  v_today := public.group_local_date(p_group_id);
  v_protect_date := v_today - 1;

  -- date_trunc('week') is Monday-based in Postgres, matching mondayOf() on the
  -- client and WEEK_STARTS_ON = 1 in src/lib/dateBoundaries.ts.
  v_week_start := date_trunc('week', v_protect_date::timestamp)::date;

  IF EXISTS (
    SELECT 1
    FROM public.streak_freezes f
    WHERE f.user_id = v_uid
      AND f.group_id = p_group_id
      AND f.week_start = v_week_start
      AND f.used_on IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A streak freeze has already been used for this week';
  END IF;

  -- Cannot protect a day that was already logged — a freeze is for a miss.
  IF EXISTS (
    SELECT 1
    FROM public.pushup_entries e
    WHERE e.user_id = v_uid
      AND e.group_id = p_group_id
      AND e.logged_for = v_protect_date
      AND e.deleted_at IS NULL
      AND e.review_status IN ('none', 'approved')
  ) THEN
    RAISE EXCEPTION 'You already logged that day — no freeze needed';
  END IF;

  INSERT INTO public.streak_freezes (user_id, group_id, week_start, used_on)
  VALUES (v_uid, p_group_id, v_week_start, v_protect_date)
  ON CONFLICT (user_id, group_id, week_start)
    DO UPDATE SET used_on = EXCLUDED.used_on
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Definer functions taking an arbitrary group id must never be callable by
-- anon/PUBLIC — PostgREST exposes every function in `public`.
REVOKE ALL ON FUNCTION public.use_streak_freeze(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.use_streak_freeze(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.use_streak_freeze(uuid) TO authenticated;

-- Close the direct-write hole. SELECT stays: the Badges card reads freezes to
-- show whether one is available, and that read is already self-or-admin scoped.
DROP POLICY IF EXISTS streak_freezes_insert_self ON public.streak_freezes;
DROP POLICY IF EXISTS streak_freezes_update_self ON public.streak_freezes;

REVOKE INSERT, UPDATE, DELETE ON public.streak_freezes FROM authenticated;
