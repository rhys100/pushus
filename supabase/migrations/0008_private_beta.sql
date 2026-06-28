-- Private beta access control + pending membership RLS fix

ALTER TABLE public.deployment_settings
  ADD COLUMN IF NOT EXISTS private_beta_enabled boolean NOT NULL DEFAULT true;

UPDATE public.deployment_settings
SET private_beta_enabled = true
WHERE id = '00000000-0000-0000-0000-000000000001';

DROP VIEW IF EXISTS public.deployment_settings_public;

CREATE VIEW public.deployment_settings_public AS
SELECT
  deployment_mode,
  billing_enabled,
  default_billing_grace_days,
  private_beta_enabled
FROM public.deployment_settings;

CREATE TABLE IF NOT EXISTS public.beta_allowed_emails (
  email text PRIMARY KEY CHECK (email = lower(trim(email))),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY beta_allowed_emails_deny_all
  ON public.beta_allowed_emails
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.is_private_beta_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ds.private_beta_enabled FROM public.deployment_settings ds LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_valid_invite_code(p_invite_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.invite_code = lower(trim(p_invite_code))
      AND g.invite_code_enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_beta_allowlisted(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.beta_allowed_emails b ON b.email = lower(u.email)
    WHERE u.id = p_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_group_access(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = p_uid
      AND gm.status IN ('active', 'pending')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_app_access(
  p_uid uuid DEFAULT auth.uid(),
  p_invite_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_private_beta_enabled() THEN
    RETURN true;
  END IF;

  IF public.user_has_group_access(p_uid) THEN
    RETURN true;
  END IF;

  IF public.is_beta_allowlisted(p_uid) THEN
    RETURN true;
  END IF;

  IF p_invite_code IS NOT NULL AND public.is_valid_invite_code(p_invite_code) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_group(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_private_beta_enabled() THEN
    RETURN true;
  END IF;

  IF public.user_has_group_access(p_uid) THEN
    RETURN true;
  END IF;

  RETURN public.is_beta_allowlisted(p_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_app_access(p_invite_code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_private_beta boolean := public.is_private_beta_enabled();
  v_allowed boolean := public.user_has_app_access(v_uid, p_invite_code);
  v_can_create boolean := public.can_create_group(v_uid);
BEGIN
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'private_beta_enabled', v_private_beta,
    'can_create_group', v_can_create,
    'has_group_access', public.user_has_group_access(v_uid),
    'is_allowlisted', public.is_beta_allowlisted(v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_onboarding_profile(
  p_display_name text,
  p_avatar_emoji text,
  p_timezone text,
  p_invite_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
BEGIN
  IF char_length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  IF NOT public.user_has_app_access(v_uid, p_invite_code) THEN
    RAISE EXCEPTION
      'PushUS is in private beta. You need an invite link or approved access to continue.';
  END IF;

  UPDATE public.profiles
  SET
    display_name = trim(p_display_name),
    avatar_emoji = COALESCE(NULLIF(trim(p_avatar_emoji), ''), avatar_emoji),
    timezone = COALESCE(NULLIF(trim(p_timezone), ''), timezone),
    updated_at = now()
  WHERE id = v_uid;
END;
$$;

-- Pending users must read their own membership row for routing
DROP POLICY IF EXISTS group_members_select_active_members_only ON public.group_members;

CREATE POLICY group_members_select_self_or_active_peers
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id, 'active')
  );

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      NOT public.is_private_beta_enabled()
      OR public.user_has_app_access(auth.uid(), NULL)
    )
  );

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
  v_billing_enabled boolean := false;
  v_billing_status billing_status := 'exempt';
BEGIN
  IF NOT public.can_create_group(v_uid) THEN
    RAISE EXCEPTION
      'PushUS is in private beta. Group creation is limited to approved organisers. Join with an invite link instead.';
  END IF;

  IF char_length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  SELECT ds.billing_enabled
  INTO v_billing_enabled
  FROM public.deployment_settings ds
  LIMIT 1;

  IF COALESCE(v_billing_enabled, false) THEN
    v_billing_status := 'incomplete';
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
    v_billing_status
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
    RAISE EXCEPTION 'Provide invite_code';
  END IF;

  IF public.is_private_beta_enabled() AND p_invite_code IS NULL THEN
    RAISE EXCEPTION 'Invite code is required during private beta';
  END IF;

  IF NOT public.user_has_app_access(v_uid, p_invite_code) THEN
    RAISE EXCEPTION
      'PushUS is in private beta. You need an invite link or approved access to join.';
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

DROP FUNCTION IF EXISTS public.get_deployment_settings();

CREATE OR REPLACE FUNCTION public.get_deployment_settings()
RETURNS TABLE (
  deployment_mode text,
  billing_enabled boolean,
  default_billing_grace_days integer,
  private_beta_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ds.deployment_mode,
    ds.billing_enabled,
    ds.default_billing_grace_days,
    ds.private_beta_enabled
  FROM public.deployment_settings ds
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_private_beta_enabled() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_invite_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_app_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_group(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_app_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_profile(text, text, text, text) TO authenticated;
