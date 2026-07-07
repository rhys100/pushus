-- Gamification goes live: XP awarding (1 rep = 1 XP, no multipliers),
-- achievement catalog seed, and server-side unlock evaluation.
-- Tables were created in 0004_phase2; this migration makes them written-to.
-- Locked rules (docs/product-decisions.md): 1 push-up = 1 XP; no set-size
-- multiplier; rest days protect streaks; freezes are cosmetic only.

-- === XP ====================================================================

-- Reps that count toward XP: live entries that are not rejected/pending review.
CREATE OR REPLACE FUNCTION public.pushup_entry_effective_count(
  p_count integer,
  p_deleted_at timestamptz,
  p_review_status entry_review_status
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_deleted_at IS NULL AND p_review_status IN ('none', 'approved') THEN p_count
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_xp_delta(
  p_user_id uuid,
  p_group_id uuid,
  p_delta integer,
  p_source public.xp_source_type,
  p_source_id uuid,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_xp_ledger (user_id, group_id, amount, source_type, source_id, description)
  VALUES (p_user_id, p_group_id, p_delta, p_source, p_source_id, p_description);

  INSERT INTO public.user_xp_totals (user_id, group_id, total_xp, updated_at)
  VALUES (p_user_id, p_group_id, GREATEST(p_delta, 0), now())
  ON CONFLICT (user_id, group_id) DO UPDATE
    SET total_xp = GREATEST(public.user_xp_totals.total_xp + p_delta, 0),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_pushup_entry_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_effective integer := 0;
  new_effective integer := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_effective :=
      public.pushup_entry_effective_count(OLD.count, OLD.deleted_at, OLD.review_status);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_effective :=
      public.pushup_entry_effective_count(NEW.count, NEW.deleted_at, NEW.review_status);
  END IF;

  PERFORM public.apply_xp_delta(
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.group_id, OLD.group_id),
    new_effective - old_effective,
    CASE WHEN TG_OP = 'INSERT'
      THEN 'pushup_entry'::public.xp_source_type
      ELSE 'adjustment'::public.xp_source_type
    END,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'Banked push-ups'
      WHEN 'UPDATE' THEN 'Entry updated'
      ELSE 'Entry removed'
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pushup_entries_award_xp ON public.pushup_entries;

CREATE TRIGGER pushup_entries_award_xp
  AFTER INSERT OR DELETE OR UPDATE OF count, deleted_at, review_status
  ON public.pushup_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pushup_entry_xp();

-- Backfill XP from history so existing members start with their earned total.
INSERT INTO public.user_xp_ledger (user_id, group_id, amount, source_type, description)
SELECT user_id, group_id, SUM(count)::integer, 'adjustment', 'Historical backfill (pre-XP entries)'
FROM public.pushup_entries
WHERE deleted_at IS NULL AND review_status IN ('none', 'approved')
GROUP BY user_id, group_id
HAVING SUM(count) > 0;

INSERT INTO public.user_xp_totals (user_id, group_id, total_xp, updated_at)
SELECT user_id, group_id, GREATEST(SUM(amount), 0), now()
FROM public.user_xp_ledger
GROUP BY user_id, group_id
ON CONFLICT (user_id, group_id) DO UPDATE
  SET total_xp = EXCLUDED.total_xp,
      updated_at = now();

-- === Streak (server-side, for achievement unlocks) =========================

-- Consecutive logged days walking back from p_as_of. Group rest days and used
-- streak freezes are skipped without breaking; a missing log on p_as_of
-- itself does not break (the day is not over yet). Mirrors
-- src/lib/gamification/streakCalc.ts.
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

    IF started OR i > 0 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_active_streak_days(uuid, uuid, date) TO authenticated;

-- === Achievement catalog ===================================================

INSERT INTO public.achievements (slug, name, description, icon_emoji, criteria, sort_order) VALUES
  ('first-bank', 'First Bank', 'Bank your first set of push-ups.', '🏁', '{"type":"first_bank"}', 10),
  ('big-set-25', 'Big Banker', 'Bank a single set of 25 or more.', '💪', '{"type":"single_set","value":25}', 20),
  ('big-set-50', 'Monster Set', 'Bank a single set of 50 or more.', '🦍', '{"type":"single_set","value":50}', 30),
  ('fifty-day', 'Fifty Day', 'Log 50 push-ups in one day.', '🔥', '{"type":"single_day_total","value":50}', 40),
  ('century-day', 'Century Day', 'Log 100 push-ups in one day.', '💯', '{"type":"single_day_total","value":100}', 50),
  ('double-century-day', 'Double Century', 'Log 200 push-ups in one day.', '🚀', '{"type":"single_day_total","value":200}', 60),
  ('total-1k', '1,000 Club', 'Reach 1,000 push-ups in this group.', '🥉', '{"type":"lifetime_total","value":1000}', 70),
  ('total-10k', '10,000 Club', 'Reach 10,000 push-ups in this group.', '🥈', '{"type":"lifetime_total","value":10000}', 80),
  ('total-100k', '100,000 Club', 'Reach 100,000 push-ups in this group.', '🥇', '{"type":"lifetime_total","value":100000}', 90),
  ('streak-7', 'Week Streak', 'Log push-ups 7 days in a row. Rest days are protected.', '📅', '{"type":"active_streak","value":7}', 100),
  ('streak-30', 'Monthly Machine', 'Log push-ups 30 days in a row. Rest days are protected.', '🗓️', '{"type":"active_streak","value":30}', 110),
  ('early-bird', 'Early Bird', 'Bank a set before 7am.', '🌅', '{"type":"local_hour_before","value":7}', 120),
  ('night-owl', 'Night Owl', 'Bank a set after 10pm.', '🦉', '{"type":"local_hour_after","value":22}', 130)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon_emoji = EXCLUDED.icon_emoji,
      criteria = EXCLUDED.criteria,
      sort_order = EXCLUDED.sort_order;

-- === Achievement unlocks ===================================================

CREATE OR REPLACE FUNCTION public.evaluate_entry_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  day_total integer;
  life_total bigint;
  local_hour integer;
  streak integer;
  tz text;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.review_status NOT IN ('none', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(count), 0)
    INTO day_total
    FROM public.pushup_entries
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND logged_for = NEW.logged_for
      AND deleted_at IS NULL AND review_status IN ('none', 'approved');

  SELECT COALESCE(SUM(count), 0)
    INTO life_total
    FROM public.pushup_entries
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id
      AND deleted_at IS NULL AND review_status IN ('none', 'approved');

  SELECT COALESCE(NULLIF(p.timezone, ''), 'UTC') INTO tz
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

  local_hour := EXTRACT(hour FROM (NEW.logged_at AT TIME ZONE COALESCE(tz, 'UTC')))::integer;

  streak := public.compute_active_streak_days(NEW.user_id, NEW.group_id, NEW.logged_for);

  INSERT INTO public.user_achievements (user_id, group_id, achievement_id)
  SELECT NEW.user_id, NEW.group_id, a.id
  FROM public.achievements a
  WHERE (a.criteria->>'type' = 'first_bank')
     OR (a.criteria->>'type' = 'single_set'
         AND NEW.count >= (a.criteria->>'value')::integer)
     OR (a.criteria->>'type' = 'single_day_total'
         AND day_total >= (a.criteria->>'value')::integer)
     OR (a.criteria->>'type' = 'lifetime_total'
         AND life_total >= (a.criteria->>'value')::bigint)
     OR (a.criteria->>'type' = 'active_streak'
         AND streak >= (a.criteria->>'value')::integer)
     OR (a.criteria->>'type' = 'local_hour_before'
         AND local_hour < (a.criteria->>'value')::integer)
     OR (a.criteria->>'type' = 'local_hour_after'
         AND local_hour >= (a.criteria->>'value')::integer)
  ON CONFLICT (user_id, group_id, achievement_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pushup_entries_evaluate_achievements ON public.pushup_entries;

CREATE TRIGGER pushup_entries_evaluate_achievements
  AFTER INSERT OR UPDATE OF count, deleted_at, review_status
  ON public.pushup_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_entry_achievements();

-- Backfill unlocks that can be derived from history (streak and time-of-day
-- achievements start unlocking from live activity only).
WITH per_day AS (
  SELECT user_id, group_id, logged_for, SUM(count) AS day_total, MAX(count) AS max_set
  FROM public.pushup_entries
  WHERE deleted_at IS NULL AND review_status IN ('none', 'approved')
  GROUP BY user_id, group_id, logged_for
),
stats AS (
  SELECT user_id, group_id,
         MAX(day_total) AS max_day,
         MAX(max_set) AS max_set,
         SUM(day_total) AS lifetime
  FROM per_day
  GROUP BY user_id, group_id
)
INSERT INTO public.user_achievements (user_id, group_id, achievement_id)
SELECT s.user_id, s.group_id, a.id
FROM stats s
CROSS JOIN public.achievements a
WHERE (a.criteria->>'type' = 'first_bank' AND s.lifetime > 0)
   OR (a.criteria->>'type' = 'single_set' AND s.max_set >= (a.criteria->>'value')::integer)
   OR (a.criteria->>'type' = 'single_day_total' AND s.max_day >= (a.criteria->>'value')::integer)
   OR (a.criteria->>'type' = 'lifetime_total' AND s.lifetime >= (a.criteria->>'value')::bigint)
ON CONFLICT (user_id, group_id, achievement_id) DO NOTHING;
