-- PushUS Slice 1A — RLS, helper functions, and RPCs

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_group_member(
  p_group_id uuid,
  p_min_status member_status DEFAULT 'active'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND (
        (p_min_status = 'active' AND gm.status = 'active')
        OR (p_min_status = 'pending' AND gm.status IN ('pending', 'active'))
        OR (p_min_status = gm.status)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role IN ('admin', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.member_role(p_group_id uuid)
RETURNS member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gm.role
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id
    AND gm.user_id = auth.uid()
    AND gm.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.group_local_date(
  p_group_id uuid,
  p_ts timestamptz DEFAULT now()
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (p_ts AT TIME ZONE g.timezone)::date
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

-- Slice 1A billing stub: exempt groups may write; incomplete/read_only/canceled may not.
CREATE OR REPLACE FUNCTION public.can_group_write(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_group_id
      AND g.billing_status = 'exempt'
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_authenticated()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_active_group_member(p_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
BEGIN
  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_group_writable(p_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_active_group_member(p_group_id);
BEGIN
  IF NOT public.can_group_write(p_group_id) THEN
    RAISE EXCEPTION 'Group is read-only or billing is incomplete';
  END IF;

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_backdate_allowed(
  p_group_id uuid,
  p_logged_for date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_policy backdate_policy;
BEGIN
  v_today := public.group_local_date(p_group_id);

  SELECT g.backdate_policy
  INTO v_policy
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF v_policy IS NULL THEN
    RETURN false;
  END IF;

  IF p_logged_for = v_today THEN
    RETURN true;
  END IF;

  IF v_policy = 'same_day' THEN
    RETURN false;
  END IF;

  IF v_policy = 'today_yesterday' THEN
    RETURN p_logged_for = (v_today - 1);
  END IF;

  IF v_policy = 'this_week' THEN
    RETURN p_logged_for >= date_trunc('week', v_today::timestamp)::date
      AND p_logged_for <= v_today;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_oversize_review_status(
  p_group_id uuid,
  p_count integer
)
RETURNS entry_review_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer;
  v_policy oversize_entry_policy;
BEGIN
  SELECT g.max_single_entry, g.oversize_entry_policy
  INTO v_max, v_policy
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF p_count <= v_max THEN
    RETURN 'none';
  END IF;

  IF v_policy = 'block' THEN
    RAISE EXCEPTION 'Entry exceeds max_single_entry (%)', v_max;
  END IF;

  IF v_policy = 'admin_review' THEN
    RETURN 'pending';
  END IF;

  RETURN 'none';
END;
$$;

CREATE OR REPLACE FUNCTION public.entry_to_jsonb(p_entry public.pushup_entries)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_entry.id,
    'group_id', p_entry.group_id,
    'user_id', p_entry.user_id,
    'count', p_entry.count,
    'logged_for', p_entry.logged_for,
    'logged_at', p_entry.logged_at,
    'is_backdated', p_entry.is_backdated,
    'review_status', p_entry.review_status,
    'source', p_entry.source,
    'deleted_at', p_entry.deleted_at,
    'created_at', p_entry.created_at,
    'updated_at', p_entry.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.write_entry_audit(
  p_entry_id uuid,
  p_group_id uuid,
  p_actor_id uuid,
  p_action audit_action,
  p_before jsonb,
  p_after jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pushup_entry_audit_log (
    entry_id,
    group_id,
    actor_id,
    action,
    before,
    after
  )
  VALUES (
    p_entry_id,
    p_group_id,
    p_actor_id,
    p_action,
    p_before,
    p_after
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Write RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_group(
  p_name text,
  p_timezone text DEFAULT 'UTC'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_group_id uuid;
BEGIN
  IF char_length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.groups (
    name,
    timezone,
    owner_id,
    billing_status
  )
  VALUES (
    trim(p_name),
    COALESCE(NULLIF(trim(p_timezone), ''), 'UTC'),
    v_uid,
    'exempt'
  )
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (
    group_id,
    user_id,
    role,
    status,
    joined_at
  )
  VALUES (
    v_group_id,
    v_uid,
    'owner',
    'active',
    now()
  );

  RETURN v_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_join_group(
  p_group_id uuid DEFAULT NULL,
  p_invite_code text DEFAULT NULL,
  p_referred_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_group public.groups%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF p_group_id IS NULL AND p_invite_code IS NULL THEN
    RAISE EXCEPTION 'Provide group_id or invite_code';
  END IF;

  IF p_group_id IS NOT NULL THEN
    SELECT *
    INTO v_group
    FROM public.groups g
    WHERE g.id = p_group_id;
  ELSE
    SELECT *
    INTO v_group
    FROM public.groups g
    WHERE g.invite_code = lower(trim(p_invite_code));
  END IF;

  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF p_invite_code IS NOT NULL AND NOT v_group.invite_code_enabled THEN
    RAISE EXCEPTION 'Invite code is disabled for this group';
  END IF;

  IF NOT public.can_group_write(v_group.id) THEN
    RAISE EXCEPTION 'Group is not accepting new members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = v_group.id
      AND gm.user_id = v_uid
      AND gm.status IN ('pending', 'active')
  ) THEN
    RAISE EXCEPTION 'Already a member or pending approval';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.group_join_requests gjr
    WHERE gjr.group_id = v_group.id
      AND gjr.user_id = v_uid
      AND gjr.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Join request already pending';
  END IF;

  IF (
    SELECT count(*)
    FROM public.group_members gm
    WHERE gm.group_id = v_group.id
      AND gm.status = 'active'
  ) >= v_group.max_members THEN
    RAISE EXCEPTION 'Group is full';
  END IF;

  INSERT INTO public.group_join_requests (
    group_id,
    user_id,
    referred_by,
    invite_code,
    status
  )
  VALUES (
    v_group.id,
    v_uid,
    p_referred_by,
    CASE WHEN p_invite_code IS NULL THEN NULL ELSE lower(trim(p_invite_code)) END,
    'pending'
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.group_members (
    group_id,
    user_id,
    role,
    status,
    referred_by
  )
  VALUES (
    v_group.id,
    v_uid,
    'member',
    'pending',
    p_referred_by
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET
    status = 'pending',
    role = 'member',
    referred_by = EXCLUDED.referred_by,
    removed_at = NULL,
    joined_at = NULL,
    updated_at = now();

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_request public.group_join_requests%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_active_count integer;
BEGIN
  SELECT *
  INTO v_request
  FROM public.group_join_requests gjr
  WHERE gjr.id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Join request is not pending';
  END IF;

  IF NOT (public.is_group_admin(v_request.group_id) OR public.is_group_owner(v_request.group_id)) THEN
    RAISE EXCEPTION 'Admin or owner role required';
  END IF;

  SELECT *
  INTO v_group
  FROM public.groups g
  WHERE g.id = v_request.group_id;

  SELECT count(*)
  INTO v_active_count
  FROM public.group_members gm
  WHERE gm.group_id = v_request.group_id
    AND gm.status = 'active';

  IF v_active_count >= v_group.max_members THEN
    RAISE EXCEPTION 'Group is full';
  END IF;

  UPDATE public.group_join_requests
  SET
    status = 'approved',
    reviewed_by = v_uid,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = v_request.id;

  UPDATE public.group_members
  SET
    status = 'active',
    joined_at = now(),
    removed_at = NULL,
    updated_at = now()
  WHERE group_id = v_request.group_id
    AND user_id = v_request.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_request public.group_join_requests%ROWTYPE;
BEGIN
  SELECT *
  INTO v_request
  FROM public.group_join_requests gjr
  WHERE gjr.id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Join request is not pending';
  END IF;

  IF NOT (public.is_group_admin(v_request.group_id) OR public.is_group_owner(v_request.group_id)) THEN
    RAISE EXCEPTION 'Admin or owner role required';
  END IF;

  UPDATE public.group_join_requests
  SET
    status = 'rejected',
    reviewed_by = v_uid,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = v_request.id;

  UPDATE public.group_members
  SET
    status = 'removed',
    removed_at = now(),
    updated_at = now()
  WHERE group_id = v_request.group_id
    AND user_id = v_request.user_id
    AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_group_name(p_group_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = v_uid
      AND gm.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Pending membership required';
  END IF;

  SELECT g.name
  INTO v_name
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  RETURN v_name;
END;
$$;

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

  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_last_entry(p_group_id uuid)
RETURNS public.pushup_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_group_writable(p_group_id);
  v_before public.pushup_entries;
  v_after public.pushup_entries;
BEGIN
  SELECT *
  INTO v_before
  FROM public.pushup_entries pe
  WHERE pe.group_id = p_group_id
    AND pe.user_id = v_uid
    AND pe.deleted_at IS NULL
  ORDER BY pe.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'No entry to undo';
  END IF;

  UPDATE public.pushup_entries
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  PERFORM public.write_entry_audit(
    v_after.id,
    p_group_id,
    v_uid,
    'undo',
    public.entry_to_jsonb(v_before),
    public.entry_to_jsonb(v_after)
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_pushup_entry(
  p_entry_id uuid,
  p_count integer
)
RETURNS public.pushup_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_before public.pushup_entries;
  v_after public.pushup_entries;
  v_review entry_review_status;
  v_today date;
BEGIN
  SELECT *
  INTO v_before
  FROM public.pushup_entries pe
  WHERE pe.id = p_entry_id
  FOR UPDATE;

  IF v_before.id IS NULL OR v_before.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  PERFORM public.assert_group_writable(v_before.group_id);

  IF NOT public.is_group_member(v_before.group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF v_before.user_id <> v_uid AND NOT public.is_group_admin(v_before.group_id) THEN
    RAISE EXCEPTION 'Not allowed to edit this entry';
  END IF;

  IF v_before.user_id = v_uid AND NOT public.is_group_admin(v_before.group_id) THEN
    v_today := public.group_local_date(v_before.group_id);
    IF v_before.logged_for <> v_today THEN
      RAISE EXCEPTION 'Same-day edit only for members';
    END IF;
  END IF;

  IF p_count IS NULL OR p_count <= 0 THEN
    RAISE EXCEPTION 'Count must be greater than zero';
  END IF;

  v_review := public.resolve_oversize_review_status(v_before.group_id, p_count);

  UPDATE public.pushup_entries
  SET
    count = p_count,
    review_status = v_review,
    source = 'manual_edit',
    updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  PERFORM public.write_entry_audit(
    v_after.id,
    v_after.group_id,
    v_uid,
    'update',
    public.entry_to_jsonb(v_before),
    public.entry_to_jsonb(v_after)
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_pushup_entry(p_entry_id uuid)
RETURNS public.pushup_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_before public.pushup_entries;
  v_after public.pushup_entries;
  v_today date;
BEGIN
  SELECT *
  INTO v_before
  FROM public.pushup_entries pe
  WHERE pe.id = p_entry_id
  FOR UPDATE;

  IF v_before.id IS NULL OR v_before.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  PERFORM public.assert_group_writable(v_before.group_id);

  IF NOT public.is_group_member(v_before.group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF v_before.user_id <> v_uid AND NOT public.is_group_admin(v_before.group_id) THEN
    RAISE EXCEPTION 'Not allowed to delete this entry';
  END IF;

  IF v_before.user_id = v_uid AND NOT public.is_group_admin(v_before.group_id) THEN
    v_today := public.group_local_date(v_before.group_id);
    IF v_before.logged_for <> v_today THEN
      RAISE EXCEPTION 'Same-day delete only for members';
    END IF;
  END IF;

  UPDATE public.pushup_entries
  SET
    deleted_at = now(),
    updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  PERFORM public.write_entry_audit(
    v_after.id,
    v_after.group_id,
    v_uid,
    'delete',
    public.entry_to_jsonb(v_before),
    public.entry_to_jsonb(v_after)
  );

  RETURN v_after;
END;
$$;

-- ---------------------------------------------------------------------------
-- Read RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_day_total(
  p_group_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_date date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_target_user uuid := COALESCE(p_user_id, v_uid);
  v_target_date date := COALESCE(p_date, public.group_local_date(p_group_id));
  v_total integer;
BEGIN
  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  SELECT COALESCE(sum(pe.count), 0)
  INTO v_total
  FROM public.pushup_entries pe
  WHERE pe.group_id = p_group_id
    AND pe.user_id = v_target_user
    AND pe.logged_for = v_target_date
    AND pe.deleted_at IS NULL
    AND pe.review_status IN ('none', 'approved');

  RETURN v_total;
END;
$$;

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
  rank bigint
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
    dense_rank() OVER (ORDER BY COALESCE(t.total, 0) DESC, p.display_name ASC) AS rank
  FROM public.group_members gm
  JOIN public.profiles p ON p.id = gm.user_id
  LEFT JOIN totals t ON t.user_id = gm.user_id
  WHERE gm.group_id = p_group_id
    AND gm.status = 'active'
  ORDER BY rank ASC, p.display_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_feed(
  p_group_id uuid,
  p_mode text DEFAULT 'recent',
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  event_type text,
  event_id uuid,
  user_id uuid,
  display_name text,
  avatar_emoji text,
  avatar_color text,
  count integer,
  logged_for date,
  logged_at timestamptz,
  created_at timestamptz,
  reaction_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visibility feed_visibility;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  PERFORM public.assert_authenticated();

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  SELECT g.feed_visibility
  INTO v_visibility
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF v_visibility = 'full_entries' OR p_mode = 'entries' THEN
    RETURN QUERY
    SELECT
      'entry'::text,
      pe.id,
      pe.user_id,
      p.display_name,
      p.avatar_emoji,
      p.avatar_color,
      pe.count,
      pe.logged_for,
      pe.logged_at,
      pe.created_at,
      (
        SELECT count(*)
        FROM public.reactions r
        WHERE r.group_id = p_group_id
          AND r.target_type = 'entry'
          AND r.target_id = pe.id
      )
    FROM public.pushup_entries pe
    JOIN public.profiles p ON p.id = pe.user_id
    WHERE pe.group_id = p_group_id
      AND pe.deleted_at IS NULL
      AND pe.review_status IN ('none', 'approved')
    ORDER BY pe.created_at DESC
    LIMIT v_limit;

    RETURN;
  END IF;

  IF v_visibility = 'daily_totals' OR p_mode = 'daily_totals' THEN
    RETURN QUERY
    WITH daily AS (
      SELECT
        pe.user_id,
        p.display_name,
        p.avatar_emoji,
        p.avatar_color,
        sum(pe.count)::integer AS day_total,
        pe.logged_for,
        max(pe.logged_at) AS latest_logged_at,
        max(pe.created_at) AS latest_created_at,
        md5(pe.group_id::text || pe.user_id::text || pe.logged_for::text) AS event_hash
      FROM public.pushup_entries pe
      JOIN public.profiles p ON p.id = pe.user_id
      WHERE pe.group_id = p_group_id
        AND pe.deleted_at IS NULL
        AND pe.review_status IN ('none', 'approved')
      GROUP BY pe.group_id, pe.user_id, pe.logged_for, p.display_name, p.avatar_emoji, p.avatar_color
    )
    SELECT
      'daily_total'::text,
      (
        substr(d.event_hash, 1, 8) || '-' ||
        substr(d.event_hash, 9, 4) || '-' ||
        substr(d.event_hash, 13, 4) || '-' ||
        substr(d.event_hash, 17, 4) || '-' ||
        substr(d.event_hash, 21, 12)
      )::uuid,
      d.user_id,
      d.display_name,
      d.avatar_emoji,
      d.avatar_color,
      d.day_total,
      d.logged_for,
      d.latest_logged_at,
      d.latest_created_at,
      0::bigint
    FROM daily d
    ORDER BY d.latest_created_at DESC
    LIMIT v_limit;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'leaderboard_total'::text,
    lb.user_id,
    lb.user_id,
    lb.display_name,
    lb.avatar_emoji,
    lb.avatar_color,
    lb.total,
    public.group_local_date(p_group_id),
    now(),
    now(),
    0::bigint
  FROM public.leaderboard_total(p_group_id) lb
  ORDER BY lb.rank ASC
  LIMIT v_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pushup_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pushup_entry_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_self_or_shared_group
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.group_members self_membership
      JOIN public.group_members peer_membership
        ON peer_membership.group_id = self_membership.group_id
      WHERE self_membership.user_id = auth.uid()
        AND self_membership.status = 'active'
        AND peer_membership.user_id = profiles.id
        AND peer_membership.status = 'active'
    )
  );

CREATE POLICY profiles_insert_self
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- groups: active members only; pending uses get_pending_group_name RPC
CREATE POLICY groups_select_active_members
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(id, 'active'));

CREATE POLICY groups_update_owner_admin
  ON public.groups
  FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(id) OR public.is_group_owner(id))
  WITH CHECK (public.is_group_admin(id) OR public.is_group_owner(id));

CREATE POLICY groups_delete_owner
  ON public.groups
  FOR DELETE
  TO authenticated
  USING (public.is_group_owner(id));

-- group_members
CREATE POLICY group_members_select_self_or_active_peers
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, 'active')
  );

CREATE POLICY group_members_update_admin
  ON public.group_members
  FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  WITH CHECK (public.is_group_admin(group_id) OR public.is_group_owner(group_id));

CREATE POLICY group_members_delete_admin
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id));

-- group_join_requests
CREATE POLICY group_join_requests_select_requester_or_admin
  ON public.group_join_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_admin(group_id)
    OR public.is_group_owner(group_id)
  );

-- pushup_entries: reads for active members; writes via RPC only
CREATE POLICY pushup_entries_select_active_members
  ON public.pushup_entries
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

-- pushup_entry_audit_log
CREATE POLICY pushup_entry_audit_log_select_admin_or_actor
  ON public.pushup_entry_audit_log
  FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR public.is_group_admin(group_id)
    OR public.is_group_owner(group_id)
  );

-- reactions
CREATE POLICY reactions_select_active_members
  ON public.reactions
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

CREATE POLICY reactions_insert_active_members
  ON public.reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(group_id, 'active')
    AND public.can_group_write(group_id)
  );

CREATE POLICY reactions_update_own
  ON public.reactions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reactions_delete_own
  ON public.reactions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, member_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_local_date(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_group_write(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_group(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_group(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_group_name(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bank_pushups(uuid, integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_last_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pushup_entry(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_pushup_entry(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_day_total(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_total(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activity_feed(uuid, text, integer) TO authenticated;
