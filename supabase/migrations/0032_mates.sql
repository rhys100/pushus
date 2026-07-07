-- Mate graph: consent-based friend connections separate from groups.
-- Locked rules (docs/product-decisions.md → Friend connection decisions):
-- consent required both ways, no public discovery, block/remove before broad
-- launch, no DMs. Connections form two ways:
--   1. Request a member of a group you share (consent = they accept).
--   2. Redeem a personal mate link/code (consent = code owner shared it).
-- All writes go through SECURITY DEFINER RPCs; tables are read-only to clients.

-- === Tables ================================================================

CREATE TYPE mate_connection_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

CREATE TABLE public.mate_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status mate_connection_status NOT NULL DEFAULT 'pending',
  -- Canonical pair so A→B and B→A cannot coexist.
  user_low uuid GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)) STORED,
  user_high uuid GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (user_low, user_high)
);

CREATE INDEX mate_connections_requester_idx ON public.mate_connections (requester_id, status);
CREATE INDEX mate_connections_addressee_idx ON public.mate_connections (addressee_id, status);

CREATE TRIGGER mate_connections_set_updated_at
  BEFORE UPDATE ON public.mate_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mate_invite_codes (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE nudge_kind AS ENUM ('push', 'cheer', 'stir');

CREATE TABLE public.mate_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind nudge_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX mate_nudges_recipient_idx ON public.mate_nudges (recipient_id, created_at DESC);
CREATE INDEX mate_nudges_sender_idx ON public.mate_nudges (sender_id, recipient_id, created_at DESC);

CREATE TYPE mate_challenge_status AS ENUM ('pending', 'active', 'declined', 'cancelled');

CREATE TABLE public.mate_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status mate_challenge_status NOT NULL DEFAULT 'pending',
  duration_days integer NOT NULL DEFAULT 3 CHECK (duration_days IN (1, 3, 7)),
  starts_at timestamptz,
  ends_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (challenger_id <> opponent_id)
);

CREATE INDEX mate_challenges_challenger_idx ON public.mate_challenges (challenger_id, status);
CREATE INDEX mate_challenges_opponent_idx ON public.mate_challenges (opponent_id, status);

CREATE TRIGGER mate_challenges_set_updated_at
  BEFORE UPDATE ON public.mate_challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- === RLS ===================================================================

ALTER TABLE public.mate_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mate_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mate_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mate_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY mate_connections_select_own
  ON public.mate_connections FOR SELECT
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY mate_invite_codes_select_own
  ON public.mate_invite_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY mate_nudges_select_own
  ON public.mate_nudges FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY mate_challenges_select_own
  ON public.mate_challenges FOR SELECT
  USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

GRANT SELECT ON public.mate_connections TO authenticated;
GRANT SELECT ON public.mate_invite_codes TO authenticated;
GRANT SELECT ON public.mate_nudges TO authenticated;
GRANT SELECT ON public.mate_challenges TO authenticated;

-- === Helpers ===============================================================

-- Two users share at least one group where both are active members.
CREATE OR REPLACE FUNCTION public.users_share_active_group(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members a
    JOIN public.group_members b ON b.group_id = a.group_id
    WHERE a.user_id = p_a AND a.status = 'active'
      AND b.user_id = p_b AND b.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.mate_pair_status(p_a uuid, p_b uuid)
RETURNS mate_connection_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT status
  FROM public.mate_connections
  WHERE user_low = LEAST(p_a, p_b) AND user_high = GREATEST(p_a, p_b);
$$;

CREATE OR REPLACE FUNCTION public.are_mates(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.mate_pair_status(p_a, p_b) = 'accepted';
$$;

-- === Connection RPCs =======================================================

CREATE OR REPLACE FUNCTION public.request_mate(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  existing public.mate_connections;
  connection_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id = caller THEN
    RAISE EXCEPTION 'You cannot mate up with yourself';
  END IF;

  IF NOT public.users_share_active_group(caller, p_user_id) THEN
    RAISE EXCEPTION 'You can only request mates you share a group with';
  END IF;

  SELECT * INTO existing
  FROM public.mate_connections
  WHERE user_low = LEAST(caller, p_user_id) AND user_high = GREATEST(caller, p_user_id);

  IF existing.id IS NOT NULL THEN
    IF existing.status = 'blocked' THEN
      RAISE EXCEPTION 'This connection is unavailable';
    END IF;

    IF existing.status = 'accepted' OR existing.status = 'pending' THEN
      RETURN existing.id;
    END IF;

    -- Previously declined: allow a fresh request from either side.
    UPDATE public.mate_connections
    SET requester_id = caller,
        addressee_id = p_user_id,
        status = 'pending',
        responded_at = NULL
    WHERE id = existing.id;

    RETURN existing.id;
  END IF;

  INSERT INTO public.mate_connections (requester_id, addressee_id)
  VALUES (caller, p_user_id)
  RETURNING id INTO connection_id;

  RETURN connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_mate_request(p_connection_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  UPDATE public.mate_connections
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END::public.mate_connection_status,
      responded_at = now()
  WHERE id = p_connection_id
    AND addressee_id = caller
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already handled';
  END IF;
END;
$$;

-- Remove a mate or cancel your own pending request.
CREATE OR REPLACE FUNCTION public.remove_mate(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  DELETE FROM public.mate_connections
  WHERE id = p_connection_id
    AND status IN ('pending', 'accepted', 'declined')
    AND (requester_id = caller OR addressee_id = caller);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_mate(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF p_user_id = caller THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  INSERT INTO public.mate_connections (requester_id, addressee_id, status, responded_at)
  VALUES (caller, p_user_id, 'blocked', now())
  ON CONFLICT (user_low, user_high) DO UPDATE
    SET requester_id = caller,
        addressee_id = p_user_id,
        status = 'blocked',
        responded_at = now();
END;
$$;

-- Only the blocker can unblock (blocker is stored as requester on block rows).
CREATE OR REPLACE FUNCTION public.unblock_mate(p_connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  DELETE FROM public.mate_connections
  WHERE id = p_connection_id
    AND status = 'blocked'
    AND requester_id = caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Block not found';
  END IF;
END;
$$;

-- === Mate code RPCs ========================================================

CREATE OR REPLACE FUNCTION public.get_my_mate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  my_code text;
BEGIN
  SELECT code INTO my_code FROM public.mate_invite_codes WHERE user_id = caller;

  IF my_code IS NULL THEN
    my_code := lower(encode(extensions.gen_random_bytes(5), 'hex'));
    INSERT INTO public.mate_invite_codes (user_id, code) VALUES (caller, my_code);
  END IF;

  RETURN my_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_mate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  my_code text := lower(encode(extensions.gen_random_bytes(5), 'hex'));
BEGIN
  INSERT INTO public.mate_invite_codes (user_id, code, rotated_at)
  VALUES (caller, my_code, now())
  ON CONFLICT (user_id) DO UPDATE
    SET code = EXCLUDED.code,
        rotated_at = now();

  RETURN my_code;
END;
$$;

-- Sharing your code is consent: redeeming creates an accepted connection.
CREATE OR REPLACE FUNCTION public.redeem_mate_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  owner uuid;
  owner_profile public.profiles;
  pair_status public.mate_connection_status;
BEGIN
  SELECT user_id INTO owner
  FROM public.mate_invite_codes
  WHERE code = lower(trim(p_code));

  IF owner IS NULL THEN
    RAISE EXCEPTION 'Invalid mate code';
  END IF;

  IF owner = caller THEN
    RAISE EXCEPTION 'That is your own mate code';
  END IF;

  pair_status := public.mate_pair_status(caller, owner);

  IF pair_status = 'blocked' THEN
    RAISE EXCEPTION 'This connection is unavailable';
  END IF;

  INSERT INTO public.mate_connections (requester_id, addressee_id, status, responded_at)
  VALUES (owner, caller, 'accepted', now())
  ON CONFLICT (user_low, user_high) DO UPDATE
    SET status = 'accepted',
        responded_at = now()
    WHERE public.mate_connections.status <> 'blocked';

  SELECT * INTO owner_profile FROM public.profiles WHERE id = owner;

  RETURN jsonb_build_object(
    'user_id', owner,
    'display_name', owner_profile.display_name,
    'avatar_emoji', owner_profile.avatar_emoji
  );
END;
$$;

-- === Read RPCs =============================================================

-- Mate list with display basics: accepted mates plus pending both ways.
-- Definer access is safe: only rows involving the caller are returned, and
-- only display fields of the counterpart profile.
CREATE OR REPLACE FUNCTION public.list_mates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'connection_id', c.id,
    'status', c.status,
    'direction', CASE WHEN c.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
    'created_at', c.created_at,
    'user', jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'name_initial', p.name_initial,
      'avatar_emoji', p.avatar_emoji
    )
  ) ORDER BY c.status, c.created_at DESC), '[]'::jsonb)
  FROM public.mate_connections c
  JOIN public.profiles p
    ON p.id = CASE WHEN c.requester_id = auth.uid() THEN c.addressee_id ELSE c.requester_id END
  WHERE (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
    AND (c.status IN ('pending', 'accepted') OR (c.status = 'blocked' AND c.requester_id = auth.uid()));
$$;

-- Aggregate stats for an accepted mate (or yourself): totals across all
-- groups, no per-entry data. Privacy: aggregates only, consent required.
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

  SELECT COALESCE(NULLIF(timezone, ''), 'UTC') INTO tz FROM public.profiles WHERE id = p_user_id;
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

-- Seven-day totals for you and your accepted mates (cross-group aggregate).
CREATE OR REPLACE FUNCTION public.mate_leaderboard(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH circle AS (
    SELECT auth.uid() AS user_id
    UNION
    SELECT CASE WHEN requester_id = auth.uid() THEN addressee_id ELSE requester_id END
    FROM public.mate_connections
    WHERE status = 'accepted' AND (requester_id = auth.uid() OR addressee_id = auth.uid())
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'name_initial', p.name_initial,
    'avatar_emoji', p.avatar_emoji,
    'total', COALESCE(t.total, 0)
  ) ORDER BY COALESCE(t.total, 0) DESC), '[]'::jsonb)
  FROM circle c
  JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN LATERAL (
    SELECT SUM(count) AS total
    FROM public.pushup_entries e
    WHERE e.user_id = c.user_id
      AND e.logged_for > ((now() AT TIME ZONE COALESCE(NULLIF(p.timezone, ''), 'UTC'))::date - GREATEST(LEAST(p_days, 90), 1))
      AND e.deleted_at IS NULL
      AND e.review_status IN ('none', 'approved')
  ) t ON true;
$$;

-- === Nudges ================================================================

-- Validates consent + rate limit and records the nudge. Push delivery happens
-- in the send-nudge edge function, which calls this first.
CREATE OR REPLACE FUNCTION public.record_nudge(p_recipient_id uuid, p_kind public.nudge_kind)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  recipient_tz text;
  recipient_today date;
  nudge_id uuid;
BEGIN
  IF NOT public.are_mates(caller, p_recipient_id) THEN
    RAISE EXCEPTION 'You can only nudge accepted mates';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'UTC') INTO recipient_tz
  FROM public.profiles WHERE id = p_recipient_id;

  recipient_today := (now() AT TIME ZONE COALESCE(recipient_tz, 'UTC'))::date;

  -- Etiquette limit: one nudge per mate per (their) day.
  IF EXISTS (
    SELECT 1 FROM public.mate_nudges
    WHERE sender_id = caller AND recipient_id = p_recipient_id
      AND (created_at AT TIME ZONE COALESCE(recipient_tz, 'UTC'))::date = recipient_today
  ) THEN
    RAISE EXCEPTION 'Already nudged today — give them a breather';
  END IF;

  INSERT INTO public.mate_nudges (sender_id, recipient_id, kind)
  VALUES (caller, p_recipient_id, p_kind)
  RETURNING id INTO nudge_id;

  RETURN nudge_id;
END;
$$;

-- === 1v1 mate challenges ===================================================

CREATE OR REPLACE FUNCTION public.create_mate_challenge(p_opponent_id uuid, p_duration_days integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  challenge_id uuid;
BEGIN
  IF NOT public.are_mates(caller, p_opponent_id) THEN
    RAISE EXCEPTION 'You can only challenge accepted mates';
  END IF;

  IF p_duration_days NOT IN (1, 3, 7) THEN
    RAISE EXCEPTION 'Duration must be 1, 3, or 7 days';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mate_challenges
    WHERE status IN ('pending', 'active')
      AND ((challenger_id = caller AND opponent_id = p_opponent_id)
        OR (challenger_id = p_opponent_id AND opponent_id = caller))
      AND (ends_at IS NULL OR ends_at > now())
  ) THEN
    RAISE EXCEPTION 'You already have a live challenge with this mate';
  END IF;

  INSERT INTO public.mate_challenges (challenger_id, opponent_id, duration_days)
  VALUES (caller, p_opponent_id, p_duration_days)
  RETURNING id INTO challenge_id;

  RETURN challenge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_mate_challenge(p_challenge_id uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF p_accept THEN
    -- Battle starts the moment it is accepted and runs the chosen duration.
    UPDATE public.mate_challenges
    SET status = 'active',
        responded_at = now(),
        starts_at = now(),
        ends_at = now() + make_interval(days => duration_days)
    WHERE id = p_challenge_id AND opponent_id = caller AND status = 'pending';
  ELSE
    UPDATE public.mate_challenges
    SET status = 'declined',
        responded_at = now()
    WHERE id = p_challenge_id AND opponent_id = caller AND status = 'pending';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found or already handled';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_mate_challenge(p_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  UPDATE public.mate_challenges
  SET status = 'cancelled'
  WHERE id = p_challenge_id
    AND status IN ('pending', 'active')
    AND (challenger_id = caller OR opponent_id = caller);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
END;
$$;

-- Challenges involving the caller, with per-side totals (cross-group reps
-- between starts_at/ends_at) and counterpart display basics.
CREATE OR REPLACE FUNCTION public.list_mate_challenges()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', mc.id,
    'status', mc.status,
    'duration_days', mc.duration_days,
    'starts_at', mc.starts_at,
    'ends_at', mc.ends_at,
    'created_at', mc.created_at,
    'is_challenger', mc.challenger_id = auth.uid(),
    'my_total', COALESCE((
      SELECT SUM(count) FROM public.pushup_entries e
      WHERE e.user_id = auth.uid()
        AND mc.starts_at IS NOT NULL
        AND e.logged_at >= mc.starts_at AND e.logged_at < mc.ends_at
        AND e.deleted_at IS NULL AND e.review_status IN ('none', 'approved')
    ), 0),
    'their_total', COALESCE((
      SELECT SUM(count) FROM public.pushup_entries e
      WHERE e.user_id = other.id
        AND mc.starts_at IS NOT NULL
        AND e.logged_at >= mc.starts_at AND e.logged_at < mc.ends_at
        AND e.deleted_at IS NULL AND e.review_status IN ('none', 'approved')
    ), 0),
    'opponent', jsonb_build_object(
      'id', other.id,
      'display_name', other.display_name,
      'name_initial', other.name_initial,
      'avatar_emoji', other.avatar_emoji
    )
  ) ORDER BY mc.created_at DESC), '[]'::jsonb)
  FROM public.mate_challenges mc
  JOIN public.profiles other
    ON other.id = CASE WHEN mc.challenger_id = auth.uid() THEN mc.opponent_id ELSE mc.challenger_id END
  WHERE (mc.challenger_id = auth.uid() OR mc.opponent_id = auth.uid())
    AND (mc.status IN ('pending', 'active')
      OR mc.updated_at > now() - interval '14 days');
$$;

-- === Grants ================================================================

GRANT EXECUTE ON FUNCTION public.users_share_active_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mate_pair_status(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_mates(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_mate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_mate_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_mate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_mate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_mate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_mate_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_mate_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_mate_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mate_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mate_leaderboard(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_nudge(uuid, public.nudge_kind) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_mate_challenge(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_mate_challenge(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mate_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_mate_challenges() TO authenticated;
