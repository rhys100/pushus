-- Profile onboarding timestamp + safe invite preview for join flow

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE public.profiles
SET onboarding_completed_at = COALESCE(updated_at, created_at)
WHERE onboarding_completed_at IS NULL;

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
    onboarding_completed_at = now(),
    updated_at = now()
  WHERE id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invite_group_preview(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_valid_invite_code(p_invite_code) THEN
    RETURN NULL;
  END IF;

  SELECT g.name
  INTO v_name
  FROM public.groups g
  WHERE g.invite_code = lower(trim(p_invite_code))
    AND g.invite_code_enabled = true;

  IF v_name IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('name', v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_group_preview(text) TO anon, authenticated;
