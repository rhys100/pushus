-- PushUS Phase 2 — training plans, competitions, gamification (XP, achievements, streaks)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE training_level AS ENUM (
  'beginner',
  'returning',
  'regular',
  'strong'
);

CREATE TYPE challenge_intensity AS ENUM (
  'easy',
  'moderate',
  'push'
);

CREATE TYPE plan_status AS ENUM (
  'active',
  'paused_injury',
  'ramp_back'
);

CREATE TYPE group_day_type AS ENUM (
  'rest',
  'easy',
  'challenge'
);

CREATE TYPE daily_checkin_status AS ENUM (
  'good',
  'bit_sore',
  'pain_stop',
  'injured_sub_out'
);

CREATE TYPE competition_kind AS ENUM (
  'weekly',
  'monthly',
  'custom'
);

CREATE TYPE challenge_type AS ENUM (
  'total_target',
  'team_total',
  'leaderboard',
  'streak',
  'improvement'
);

CREATE TYPE competition_intensity AS ENUM (
  'fun',
  'moderate',
  'hard',
  'stupid'
);

CREATE TYPE xp_source_type AS ENUM (
  'pushup_entry',
  'daily_goal',
  'streak_milestone',
  'challenge_complete',
  'admin_badge',
  'adjustment'
);

-- ---------------------------------------------------------------------------
-- Training & goals
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  daily_target integer NOT NULL CHECK (daily_target > 0),
  weekly_target integer NOT NULL CHECK (weekly_target > 0),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, effective_from)
);

CREATE INDEX user_goals_group_user_idx ON public.user_goals (group_id, user_id);

CREATE TRIGGER user_goals_set_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  wizard_completed boolean NOT NULL DEFAULT false,
  max_clean_set integer NOT NULL DEFAULT 10 CHECK (max_clean_set > 0),
  training_level training_level NOT NULL DEFAULT 'beginner',
  challenge_intensity challenge_intensity NOT NULL DEFAULT 'moderate',
  preferred_training_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  rest_days integer[] NOT NULL DEFAULT '{0,6}',
  easy_days integer[] NOT NULL DEFAULT '{}',
  recommended_set_size integer NOT NULL DEFAULT 10 CHECK (recommended_set_size > 0),
  overage_soft_cap integer NOT NULL DEFAULT 5 CHECK (overage_soft_cap >= 0),
  warning_cap integer NOT NULL DEFAULT 20 CHECK (warning_cap > 0),
  plan_status plan_status NOT NULL DEFAULT 'active',
  ramp_back_week integer NOT NULL DEFAULT 0 CHECK (ramp_back_week >= 0),
  estimated_capacity integer NOT NULL DEFAULT 20 CHECK (estimated_capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

CREATE INDEX user_training_plans_group_idx ON public.user_training_plans (group_id);

CREATE TRIGGER user_training_plans_set_updated_at
  BEFORE UPDATE ON public.user_training_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_rest_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_type group_day_type NOT NULL DEFAULT 'rest',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, day_of_week)
);

CREATE INDEX group_rest_days_group_idx ON public.group_rest_days (group_id);

CREATE TABLE public.user_daily_status_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  status daily_checkin_status NOT NULL DEFAULT 'good',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, checkin_date)
);

CREATE INDEX user_daily_status_checkins_group_date_idx
  ON public.user_daily_status_checkins (group_id, checkin_date DESC);

-- ---------------------------------------------------------------------------
-- Competitions
-- ---------------------------------------------------------------------------

CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  competition_kind competition_kind NOT NULL DEFAULT 'weekly',
  challenge_type challenge_type NOT NULL DEFAULT 'leaderboard',
  intensity competition_intensity NOT NULL DEFAULT 'moderate',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  replaces_daily_plan boolean NOT NULL DEFAULT false,
  target_total integer CHECK (target_total IS NULL OR target_total > 0),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX competitions_group_starts_idx
  ON public.competitions (group_id, starts_at DESC);

CREATE TRIGGER competitions_set_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.competition_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  official_scoring_starts_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, user_id)
);

CREATE INDEX competition_participants_user_idx
  ON public.competition_participants (user_id);

CREATE TABLE public.challenge_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX challenge_teams_competition_idx ON public.challenge_teams (competition_id);

CREATE TABLE public.challenge_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.challenge_teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX challenge_team_members_user_idx ON public.challenge_team_members (user_id);

-- ---------------------------------------------------------------------------
-- Achievements & badges
-- ---------------------------------------------------------------------------

CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon_emoji text NOT NULL DEFAULT '🏅',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements (id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, achievement_id)
);

CREATE INDEX user_achievements_group_user_idx
  ON public.user_achievements (group_id, user_id);

CREATE TABLE public.custom_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  description text,
  icon_emoji text NOT NULL DEFAULT '🎖️',
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX custom_badges_group_idx ON public.custom_badges (group_id);

CREATE TABLE public.user_custom_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_badge_id uuid NOT NULL REFERENCES public.custom_badges (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  awarded_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE (custom_badge_id, user_id)
);

CREATE INDEX user_custom_badges_group_user_idx
  ON public.user_custom_badges (group_id, user_id);

-- ---------------------------------------------------------------------------
-- XP & streak freezes
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  source_type xp_source_type NOT NULL,
  source_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_xp_ledger_group_user_created_idx
  ON public.user_xp_ledger (group_id, user_id, created_at DESC);

CREATE UNIQUE INDEX user_xp_ledger_entry_once_idx
  ON public.user_xp_ledger (source_type, source_id)
  WHERE source_type = 'pushup_entry' AND source_id IS NOT NULL;

CREATE TABLE public.user_xp_totals (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE public.streak_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  used_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, week_start)
);

CREATE INDEX streak_freezes_group_user_idx ON public.streak_freezes (group_id, user_id);

-- ---------------------------------------------------------------------------
-- Achievement catalog seed
-- ---------------------------------------------------------------------------

INSERT INTO public.achievements (slug, name, description, icon_emoji, criteria, sort_order)
VALUES
  (
    'first_100',
    'First 100',
    'Bank 100 lifetime push-ups in this group.',
    '💯',
    '{"lifetime_total": 100}'::jsonb,
    10
  ),
  (
    'first_500',
    'First 500',
    'Bank 500 lifetime push-ups in this group.',
    '🔥',
    '{"lifetime_total": 500}'::jsonb,
    20
  ),
  (
    'first_1000',
    'First 1000',
    'Bank 1,000 lifetime push-ups in this group.',
    '🚀',
    '{"lifetime_total": 1000}'::jsonb,
    30
  ),
  (
    'streak_7_active',
    '7-day active streak',
    'Log push-ups on 7 consecutive active days.',
    '📅',
    '{"active_streak": 7}'::jsonb,
    40
  ),
  (
    'streak_7_goal',
    '7-day goal streak',
    'Hit your daily goal 7 days in a row.',
    '🎯',
    '{"goal_streak": 7}'::jsonb,
    50
  ),
  (
    'personal_best_day',
    'Personal best day',
    'Set a new single-day record.',
    '⭐',
    '{"personal_best_day": true}'::jsonb,
    60
  ),
  (
    'biggest_set_week',
    'Biggest set this week',
    'Log the largest single set in the group this week.',
    '💪',
    '{"biggest_set_week": true}'::jsonb,
    70
  ),
  (
    'challenge_winner',
    'Challenge winner',
    'Win a group challenge.',
    '🏆',
    '{"challenge_winner": true}'::jsonb,
    80
  );

-- ---------------------------------------------------------------------------
-- XP helpers & RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_user_xp_total(
  p_user_id uuid,
  p_group_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT COALESCE(sum(amount), 0)
  INTO v_total
  FROM public.user_xp_ledger
  WHERE user_id = p_user_id
    AND group_id = p_group_id;

  INSERT INTO public.user_xp_totals (user_id, group_id, total_xp, updated_at)
  VALUES (p_user_id, p_group_id, v_total, now())
  ON CONFLICT (user_id, group_id) DO UPDATE
  SET
    total_xp = EXCLUDED.total_xp,
    updated_at = now();

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_xp(
  p_user_id uuid,
  p_group_id uuid,
  p_amount integer,
  p_source_type xp_source_type,
  p_source_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount = 0 THEN
    RETURN public.refresh_user_xp_total(p_user_id, p_group_id);
  END IF;

  INSERT INTO public.user_xp_ledger (
    user_id,
    group_id,
    amount,
    source_type,
    source_id,
    description
  )
  VALUES (
    p_user_id,
    p_group_id,
    p_amount,
    p_source_type,
    p_source_id,
    p_description
  )
  ON CONFLICT (source_type, source_id)
    WHERE source_type = 'pushup_entry' AND source_id IS NOT NULL
  DO NOTHING;

  RETURN public.refresh_user_xp_total(p_user_id, p_group_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_xp_for_entry(p_entry public.pushup_entries)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_entry.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  PERFORM public.award_xp(
    p_entry.user_id,
    p_entry.group_id,
    p_entry.count,
    'pushup_entry',
    p_entry.id,
    format('+%s XP for %s push-ups', p_entry.count, p_entry.count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_xp_total(
  p_group_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_target uuid := COALESCE(p_user_id, v_uid);
  v_total bigint;
BEGIN
  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  SELECT total_xp
  INTO v_total
  FROM public.user_xp_totals
  WHERE user_id = v_target
    AND group_id = p_group_id;

  RETURN COALESCE(v_total, 0);
END;
$$;

-- Extend bank_pushups to award XP on successful bank (1 XP per push-up)
CREATE OR REPLACE FUNCTION public.bank_pushups(
  p_group_id uuid,
  p_count integer,
  p_logged_for date DEFAULT NULL
)
RETURNS public.pushup_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_group_writable(p_group_id);
  v_today date := public.group_local_date(p_group_id);
  v_logged_for date := COALESCE(p_logged_for, v_today);
  v_review entry_review_status;
  v_entry public.pushup_entries;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RAISE EXCEPTION 'Count must be greater than zero';
  END IF;

  IF NOT public.is_backdate_allowed(p_group_id, v_logged_for) THEN
    RAISE EXCEPTION 'Backdating not allowed for this group';
  END IF;

  v_review := public.resolve_oversize_review_status(p_group_id, p_count);

  INSERT INTO public.pushup_entries (
    group_id,
    user_id,
    count,
    logged_for,
    logged_at,
    is_backdated,
    review_status,
    source
  )
  VALUES (
    p_group_id,
    v_uid,
    p_count,
    v_logged_for,
    now(),
    v_logged_for <> v_today,
    v_review,
    'circle_logger'
  )
  RETURNING * INTO v_entry;

  PERFORM public.write_entry_audit(
    v_entry.id,
    p_group_id,
    v_uid,
    'create',
    NULL,
    public.entry_to_jsonb(v_entry)
  );

  PERFORM public.award_xp_for_entry(v_entry);

  RETURN v_entry;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_rest_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_status_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_freezes ENABLE ROW LEVEL SECURITY;

-- user_goals
CREATE POLICY user_goals_select_active_members
  ON public.user_goals
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY user_goals_insert_self
  ON public.user_goals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(group_id, 'active')
  );

CREATE POLICY user_goals_update_self
  ON public.user_goals
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_group_member(group_id, 'active'))
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, 'active'));

-- user_training_plans
CREATE POLICY user_training_plans_select_active_members
  ON public.user_training_plans
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY user_training_plans_insert_self
  ON public.user_training_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(group_id, 'active')
  );

CREATE POLICY user_training_plans_update_self
  ON public.user_training_plans
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_group_member(group_id, 'active'))
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, 'active'));

-- group_rest_days
CREATE POLICY group_rest_days_select_active_members
  ON public.group_rest_days
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY group_rest_days_write_admin
  ON public.group_rest_days
  FOR ALL
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  WITH CHECK (public.is_group_admin(group_id) OR public.is_group_owner(group_id));

-- user_daily_status_checkins
CREATE POLICY user_daily_status_checkins_select_active_members
  ON public.user_daily_status_checkins
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY user_daily_status_checkins_insert_self
  ON public.user_daily_status_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(group_id, 'active')
  );

CREATE POLICY user_daily_status_checkins_update_self
  ON public.user_daily_status_checkins
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_group_member(group_id, 'active'))
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, 'active'));

-- competitions
CREATE POLICY competitions_select_active_members
  ON public.competitions
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY competitions_write_admin
  ON public.competitions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  );

CREATE POLICY competitions_update_admin
  ON public.competitions
  FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  WITH CHECK (public.is_group_admin(group_id) OR public.is_group_owner(group_id));

CREATE POLICY competitions_delete_admin
  ON public.competitions
  FOR DELETE
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id));

-- competition_participants
CREATE POLICY competition_participants_select_active_members
  ON public.competition_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );

CREATE POLICY competition_participants_insert_self
  ON public.competition_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );

-- challenge_teams
CREATE POLICY challenge_teams_select_active_members
  ON public.challenge_teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );

CREATE POLICY challenge_teams_write_admin
  ON public.challenge_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND (public.is_group_admin(c.group_id) OR public.is_group_owner(c.group_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND (public.is_group_admin(c.group_id) OR public.is_group_owner(c.group_id))
    )
  );

-- challenge_team_members
CREATE POLICY challenge_team_members_select_active_members
  ON public.challenge_team_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_teams ct
      JOIN public.competitions c ON c.id = ct.competition_id
      WHERE ct.id = team_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );

CREATE POLICY challenge_team_members_insert_self
  ON public.challenge_team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.challenge_teams ct
      JOIN public.competitions c ON c.id = ct.competition_id
      WHERE ct.id = team_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );

-- achievements catalog (read-only for authenticated)
CREATE POLICY achievements_select_authenticated
  ON public.achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- user_achievements
CREATE POLICY user_achievements_select_active_members
  ON public.user_achievements
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

-- custom_badges
CREATE POLICY custom_badges_select_active_members
  ON public.custom_badges
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY custom_badges_write_admin
  ON public.custom_badges
  FOR ALL
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  WITH CHECK (
    created_by = auth.uid()
    AND (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  );

-- user_custom_badges
CREATE POLICY user_custom_badges_select_active_members
  ON public.user_custom_badges
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY user_custom_badges_write_admin
  ON public.user_custom_badges
  FOR ALL
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  WITH CHECK (
    awarded_by = auth.uid()
    AND (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  );

-- user_xp_ledger (read own + group peers; writes via RPC only)
CREATE POLICY user_xp_ledger_select_active_members
  ON public.user_xp_ledger
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

-- user_xp_totals
CREATE POLICY user_xp_totals_select_active_members
  ON public.user_xp_totals
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

-- streak_freezes
CREATE POLICY streak_freezes_select_self_or_admin
  ON public.streak_freezes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_admin(group_id)
    OR public.is_group_owner(group_id)
  );

CREATE POLICY streak_freezes_insert_self
  ON public.streak_freezes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(group_id, 'active')
  );

CREATE POLICY streak_freezes_update_self
  ON public.streak_freezes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.is_group_member(group_id, 'active'))
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id, 'active'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_training_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_rest_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_daily_status_checkins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_team_members TO authenticated;
GRANT SELECT ON public.achievements TO authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_badges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_badges TO authenticated;
GRANT SELECT ON public.user_xp_ledger TO authenticated;
GRANT SELECT ON public.user_xp_totals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.streak_freezes TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_xp_total(uuid, uuid) TO authenticated;
