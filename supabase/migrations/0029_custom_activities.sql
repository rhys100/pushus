-- PushUS — custom activities (personal rep tracking) + public rep totals
--
-- 1. custom_activities: per-user exercises (e.g. calf raises, pull-ups) with
--    optional left/right side tracking. Private to the owning user.
-- 2. custom_activity_entries: banked sets for a custom activity.
-- 3. profiles.show_rep_totals: opt-in to show raw rep totals (instead of %)
--    to other members on the daily leaderboard.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE activity_side AS ENUM (
  'left',
  'right'
);

-- ---------------------------------------------------------------------------
-- custom_activities
-- ---------------------------------------------------------------------------

CREATE TABLE public.custom_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  emoji text NOT NULL DEFAULT '🏋️',
  track_sides boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX custom_activities_user_active_name_idx
  ON public.custom_activities (user_id, lower(trim(name)))
  WHERE archived_at IS NULL;

CREATE INDEX custom_activities_user_position_idx
  ON public.custom_activities (user_id, position, created_at);

CREATE TRIGGER custom_activities_set_updated_at
  BEFORE UPDATE ON public.custom_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- custom_activity_entries
-- ---------------------------------------------------------------------------

CREATE TABLE public.custom_activity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.custom_activities (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  count integer NOT NULL CHECK (count > 0 AND count <= 1000),
  side activity_side,
  logged_for date NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX custom_activity_entries_user_activity_date_idx
  ON public.custom_activity_entries (user_id, activity_id, logged_for DESC);

CREATE INDEX custom_activity_entries_activity_created_desc_idx
  ON public.custom_activity_entries (activity_id, created_at DESC);

CREATE TRIGGER custom_activity_entries_set_updated_at
  BEFORE UPDATE ON public.custom_activity_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — personal data, owner-only for every operation
-- ---------------------------------------------------------------------------

ALTER TABLE public.custom_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_activity_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY custom_activities_select_self
  ON public.custom_activities
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY custom_activities_insert_self
  ON public.custom_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY custom_activities_update_self
  ON public.custom_activities
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY custom_activities_delete_self
  ON public.custom_activities
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY custom_activity_entries_select_self
  ON public.custom_activity_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY custom_activity_entries_insert_self
  ON public.custom_activity_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.custom_activities ca
      WHERE ca.id = activity_id
        AND ca.user_id = auth.uid()
        AND ca.archived_at IS NULL
    )
  );

CREATE POLICY custom_activity_entries_update_self
  ON public.custom_activity_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY custom_activity_entries_delete_self
  ON public.custom_activity_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- profiles.show_rep_totals — opt-in public rep totals on the board
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN show_rep_totals boolean NOT NULL DEFAULT false;

-- leaderboard_total gains a show_rep_totals column so the client can decide
-- whether to render raw reps or % for each member. Return type changes, so
-- the old function must be dropped first.
DROP FUNCTION IF EXISTS public.leaderboard_total(uuid, date, date);

CREATE OR REPLACE FUNCTION public.leaderboard_total(
  p_group_id uuid,
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
BEGIN
  PERFORM public.assert_authenticated();

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  v_today := public.group_local_date(p_group_id);
  v_end := COALESCE(p_period_end, v_today);
  v_start := COALESCE(
    p_period_start,
    date_trunc('week', v_today::timestamp)::date
  );

  RETURN QUERY
  WITH totals AS (
    SELECT
      pe.user_id,
      COALESCE(sum(pe.count), 0)::integer AS total
    FROM public.pushup_entries pe
    WHERE pe.group_id = p_group_id
      AND pe.logged_for >= v_start
      AND pe.logged_for <= v_end
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    GROUP BY pe.user_id
  )
  SELECT
    p.id AS user_id,
    p.display_name,
    p.avatar_emoji,
    p.avatar_color,
    COALESCE(t.total, 0) AS total,
    dense_rank() OVER (ORDER BY COALESCE(t.total, 0) DESC, p.display_name ASC) AS rank,
    p.show_rep_totals
  FROM public.group_members gm
  JOIN public.profiles p ON p.id = gm.user_id
  LEFT JOIN totals t ON t.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
    AND gm.status = 'active'
  ORDER BY rank ASC, p.display_name ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_activity_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_total(uuid, date, date) TO authenticated;
