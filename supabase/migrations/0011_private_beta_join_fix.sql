-- Harden private beta checks: JWT email fallback + invite join after group resolve

CREATE OR REPLACE FUNCTION public.is_beta_allowlisted(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = p_uid;

  IF v_email IS NULL THEN
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  END IF;

  IF v_email = '' OR v_email IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.beta_allowed_emails b
    WHERE b.email = v_email
  );
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
    RAISE EXCEPTION 'Provide invite_code';
  END IF;

  IF public.is_private_beta_enabled() AND p_invite_code IS NULL THEN
    RAISE EXCEPTION 'Invite code is required during private beta';
  END IF;

  IF p_invite_code IS NOT NULL THEN
    SELECT *
    INTO v_group
    FROM public.groups g
    WHERE g.invite_code = lower(trim(p_invite_code));
  ELSE
    SELECT *
    INTO v_group
    FROM public.groups g
    WHERE g.id = p_group_id;
  END IF;

  IF v_group.id IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF public.is_private_beta_enabled() THEN
    IF NOT (
      public.user_has_group_access(v_uid)
      OR public.is_beta_allowlisted(v_uid)
      OR p_invite_code IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        'PushUS is in private beta. You need an invite link or approved access to join.';
    END IF;
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

ALTER TABLE public.beta_allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS beta_allowed_emails_deny_all ON public.beta_allowed_emails;

CREATE POLICY beta_allowed_emails_deny_all
  ON public.beta_allowed_emails
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
