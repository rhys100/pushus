-- ---------------------------------------------------------------------------
-- 0049: earned streak-freeze BONUSES, on top of the weekly entitlement
--
-- docs/product-decisions.md locks "Streak freezes: default 1 per week". This
-- migration does NOT change that. The weekly entitlement stays exactly as it
-- is; a run of clean weeks earns an ADDITIONAL freeze, capped. That is strictly
-- more generous than today, so no locked rule needs amending — replacing the
-- weekly entitlement with an earned-only model would, and is not done here.
--
-- Freezes remain cosmetic: nothing below writes a pushup_entries row or an XP
-- ledger entry, and neither streak walker (compute_active_streak_days in 0035,
-- or computeActiveStreak on the client) is touched.
--
-- Depends on 0048, which moved freeze spending behind use_streak_freeze().
-- ---------------------------------------------------------------------------

-- Per-group tuning. Defaults chosen to be gentle: a fortnight of clean weeks
-- earns one spare, and nobody can bank more than three.
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS freeze_earn_weeks smallint NOT NULL DEFAULT 2
    CHECK (freeze_earn_weeks BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS freeze_max_banked smallint NOT NULL DEFAULT 3
    CHECK (freeze_max_banked BETWEEN 0 AND 10);

-- Earned bonuses live in their own table rather than as extra rows in
-- streak_freezes: that table's UNIQUE (user_id, group_id, week_start) IS the
-- weekly entitlement, so a second row per week cannot represent a bonus.
CREATE TABLE IF NOT EXISTS public.streak_freeze_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  -- Monday of the week whose completion earned this bonus. Also the idempotency
  -- key: the granter can run as often as it likes without double-awarding.
  earned_for_week date NOT NULL,
  used_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, earned_for_week)
);

CREATE INDEX IF NOT EXISTS streak_freeze_bonuses_group_user_idx
  ON public.streak_freeze_bonuses (group_id, user_id);

ALTER TABLE public.streak_freeze_bonuses ENABLE ROW LEVEL SECURITY;

-- Read-only to members, and only their own. Writes go through the definer
-- functions below — the same hole 0048 closed for streak_freezes must not be
-- re-opened here.
CREATE POLICY streak_freeze_bonuses_select_self
  ON public.streak_freeze_bonuses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.is_group_member(group_id, 'active'));

GRANT SELECT ON public.streak_freeze_bonuses TO authenticated;

-- ---------------------------------------------------------------------------
-- Granting
-- ---------------------------------------------------------------------------

/**
 * Award any bonuses the caller has earned but not yet been given.
 *
 * A week is "clean" when, for a COMPLETE Monday-Sunday week in the group's
 * timezone: every non-protected day was logged, at least one day was logged,
 * and no freeze was spent. Protected = a group rest day.
 *
 * Injury-paused weeks are SKIPPED NEUTRALLY — neither clean nor breaking. The
 * locked rule is "Injury pauses streaks — does not silently break or fake
 * progress"; counting an injured week as clean would accrue rewards for time
 * away, and counting it as broken would punish the injury.
 *
 * Idempotent via UNIQUE (user_id, group_id, earned_for_week).
 */
CREATE OR REPLACE FUNCTION public.grant_earned_streak_freezes(p_group_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_active_group_member(p_group_id);
  v_today date := public.group_local_date(p_group_id);
  v_since date;
  v_earn_weeks smallint;
  v_max_banked smallint;
  v_logged date[];
  v_rest_dows int[];
  v_injury date[];
  v_week date;
  v_day date;
  v_clean boolean;
  v_logged_any boolean;
  v_run integer := 0;
  v_granted integer := 0;
  v_held integer;
BEGIN
  SELECT g.freeze_earn_weeks, g.freeze_max_banked
    INTO v_earn_weeks, v_max_banked
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF v_max_banked = 0 THEN
    RETURN 0;
  END IF;

  -- Look back a fixed window rather than all history; a run longer than this
  -- has already earned everything the cap allows.
  v_since := date_trunc('week', (v_today - 180)::timestamp)::date;

  -- Pre-fetch the whole window in three queries. The obvious shape — an EXISTS
  -- per day — is ~180 round trips inside the function for one call.
  SELECT coalesce(array_agg(DISTINCT e.logged_for), '{}')
    INTO v_logged
  FROM public.pushup_entries e
  WHERE e.user_id = v_uid
    AND e.group_id = p_group_id
    AND e.logged_for >= v_since
    AND e.deleted_at IS NULL
    AND e.review_status IN ('none', 'approved');

  SELECT coalesce(array_agg(r.day_of_week), '{}')
    INTO v_rest_dows
  FROM public.group_rest_days r
  WHERE r.group_id = p_group_id
    AND r.day_type = 'rest';

  -- injury_episodes is per-USER, not per-group (0035): there is no group_id
  -- column, and availability applies wherever the member trains. Columns are
  -- `since` / `ended`, and `ended IS NULL` means the episode is ongoing.
  SELECT coalesce(array_agg(d::date), '{}')
    INTO v_injury
  FROM public.injury_episodes ie
  CROSS JOIN LATERAL generate_series(
    greatest(ie.since, v_since),
    least(coalesce(ie.ended, v_today), v_today),
    interval '1 day'
  ) AS d
  WHERE ie.user_id = v_uid;

  -- Walk complete weeks oldest to newest, counting the current clean run.
  v_week := v_since;
  WHILE v_week + 6 < v_today LOOP
    v_clean := true;
    v_logged_any := false;

    -- An injury anywhere in the week makes it neutral: the run neither grows
    -- nor resets, so time away costs nothing and earns nothing.
    IF EXISTS (
      SELECT 1 FROM unnest(v_injury) AS i(d)
      WHERE i.d BETWEEN v_week AND v_week + 6
    ) THEN
      v_week := v_week + 7;
      CONTINUE;
    END IF;

    FOR v_day IN SELECT generate_series(v_week, v_week + 6, interval '1 day')::date LOOP
      IF extract(isodow FROM v_day)::int = ANY (
        -- group_rest_days stores 0=Sunday..6=Saturday; isodow is 1=Mon..7=Sun.
        SELECT CASE WHEN dow = 0 THEN 7 ELSE dow END FROM unnest(v_rest_dows) AS r(dow)
      ) THEN
        CONTINUE;
      END IF;

      IF v_day = ANY (v_logged) THEN
        v_logged_any := true;
      ELSE
        v_clean := false;
        EXIT;
      END IF;
    END LOOP;

    -- Spending a freeze that week means the week was not clean on its own.
    IF v_clean AND EXISTS (
      SELECT 1 FROM public.streak_freezes f
      WHERE f.user_id = v_uid AND f.group_id = p_group_id
        AND f.used_on BETWEEN v_week AND v_week + 6
    ) THEN
      v_clean := false;
    END IF;

    IF v_clean AND v_logged_any THEN
      v_run := v_run + 1;

      IF v_run % v_earn_weeks = 0 THEN
        SELECT count(*) INTO v_held
        FROM public.streak_freeze_bonuses b
        WHERE b.user_id = v_uid AND b.group_id = p_group_id AND b.used_on IS NULL;

        IF v_held < v_max_banked THEN
          INSERT INTO public.streak_freeze_bonuses (user_id, group_id, earned_for_week)
          VALUES (v_uid, p_group_id, v_week)
          ON CONFLICT (user_id, group_id, earned_for_week) DO NOTHING;

          IF FOUND THEN
            v_granted := v_granted + 1;
          END IF;
        END IF;
      END IF;
    ELSE
      v_run := 0;
    END IF;

    v_week := v_week + 7;
  END LOOP;

  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_earned_streak_freezes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_earned_streak_freezes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_earned_streak_freezes(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Spending: weekly entitlement first, then a bonus
-- ---------------------------------------------------------------------------

-- 0048 defined this RETURNS public.streak_freezes. CREATE OR REPLACE cannot
-- change a function's return type — it errors with "cannot change return type
-- of existing function" — so the old signature must be dropped first. This is
-- the same reason 0029 had to DROP before redefining.
DROP FUNCTION IF EXISTS public.use_streak_freeze(uuid);

CREATE OR REPLACE FUNCTION public.use_streak_freeze(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_active_group_member(p_group_id);
  v_today date;
  v_protect_date date;
  v_week_start date;
  v_bonus_id uuid;
BEGIN
  v_today := public.group_local_date(p_group_id);
  v_protect_date := v_today - 1;
  v_week_start := date_trunc('week', v_protect_date::timestamp)::date;

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

  -- Weekly entitlement first, so a hard-earned bonus is never spent while the
  -- free one is still sitting there.
  IF NOT EXISTS (
    SELECT 1
    FROM public.streak_freezes f
    WHERE f.user_id = v_uid
      AND f.group_id = p_group_id
      AND f.week_start = v_week_start
      AND f.used_on IS NOT NULL
  ) THEN
    INSERT INTO public.streak_freezes (user_id, group_id, week_start, used_on)
    VALUES (v_uid, p_group_id, v_week_start, v_protect_date)
    ON CONFLICT (user_id, group_id, week_start)
      DO UPDATE SET used_on = EXCLUDED.used_on;

    RETURN jsonb_build_object('source', 'weekly', 'protected_on', v_protect_date);
  END IF;

  SELECT b.id INTO v_bonus_id
  FROM public.streak_freeze_bonuses b
  WHERE b.user_id = v_uid AND b.group_id = p_group_id AND b.used_on IS NULL
  ORDER BY b.earned_for_week
  LIMIT 1;

  IF v_bonus_id IS NULL THEN
    RAISE EXCEPTION 'No streak freeze available — this week''s is used and you have no spares';
  END IF;

  UPDATE public.streak_freeze_bonuses
  SET used_on = v_protect_date
  WHERE id = v_bonus_id;

  -- The streak walkers only read streak_freezes, so a spent bonus must also
  -- leave a row there for the protection to actually apply. Keyed on the
  -- protected day's own week, which the entitlement branch above already used —
  -- so update that row rather than colliding with it.
  INSERT INTO public.streak_freezes (user_id, group_id, week_start, used_on)
  VALUES (v_uid, p_group_id, v_week_start, v_protect_date)
  ON CONFLICT (user_id, group_id, week_start)
    DO UPDATE SET used_on = EXCLUDED.used_on;

  RETURN jsonb_build_object('source', 'bonus', 'protected_on', v_protect_date);
END;
$$;

REVOKE ALL ON FUNCTION public.use_streak_freeze(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.use_streak_freeze(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.use_streak_freeze(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reading the balance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.streak_freeze_state(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_active_group_member(p_group_id);
  v_today date := public.group_local_date(p_group_id);
  v_week_start date;
  v_weekly_used boolean;
  v_bonuses integer;
  v_earn_weeks smallint;
BEGIN
  v_week_start := date_trunc('week', (v_today - 1)::timestamp)::date;

  SELECT EXISTS (
    SELECT 1 FROM public.streak_freezes f
    WHERE f.user_id = v_uid AND f.group_id = p_group_id
      AND f.week_start = v_week_start AND f.used_on IS NOT NULL
  ) INTO v_weekly_used;

  SELECT count(*) INTO v_bonuses
  FROM public.streak_freeze_bonuses b
  WHERE b.user_id = v_uid AND b.group_id = p_group_id AND b.used_on IS NULL;

  SELECT g.freeze_earn_weeks INTO v_earn_weeks
  FROM public.groups g WHERE g.id = p_group_id;

  RETURN jsonb_build_object(
    'weekly_available', NOT v_weekly_used,
    'bonus_available', v_bonuses,
    'earn_weeks', v_earn_weeks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.streak_freeze_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.streak_freeze_state(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.streak_freeze_state(uuid) TO authenticated;
