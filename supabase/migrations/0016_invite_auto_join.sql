-- Valid invite links auto-join: the admin invite is the trust signal.
-- Joins without an invite code still require manual approval.

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
  v_auto_approve boolean := p_invite_code IS NOT NULL;
  v_member_status member_status := CASE
    WHEN p_invite_code IS NOT NULL THEN 'active'::member_status
    ELSE 'pending'::member_status
  END;
  v_request_status join_request_status := CASE
    WHEN p_invite_code IS NOT NULL THEN 'approved'::join_request_status
    ELSE 'pending'::join_request_status
  END;
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
    status,
    reviewed_at
  )
  VALUES (
    v_group.id,
    v_uid,
    p_referred_by,
    CASE WHEN p_invite_code IS NULL THEN NULL ELSE lower(trim(p_invite_code)) END,
    v_request_status,
    CASE WHEN v_auto_approve THEN now() ELSE NULL END
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.group_members (
    group_id,
    user_id,
    role,
    status,
    referred_by,
    joined_at
  )
  VALUES (
    v_group.id,
    v_uid,
    'member',
    v_member_status,
    p_referred_by,
    CASE WHEN v_auto_approve THEN now() ELSE NULL END
  )
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET
    status = EXCLUDED.status,
    role = 'member',
    referred_by = EXCLUDED.referred_by,
    removed_at = NULL,
    joined_at = EXCLUDED.joined_at,
    updated_at = now();

  RETURN v_request_id;
END;
$$;
