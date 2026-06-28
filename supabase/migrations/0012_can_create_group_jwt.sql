-- Allowlist check via JWT email for create_group callers

CREATE OR REPLACE FUNCTION public.can_create_group(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
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

  PERFORM set_config('row_security', 'off', true);

  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = p_uid;

  IF v_email IS NULL OR v_email = '' THEN
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  END IF;

  IF v_email = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.beta_allowed_emails b
    WHERE b.email = v_email
  );
END;
$$;

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

  IF v_email IS NULL OR v_email = '' THEN
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  END IF;

  IF v_email = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.beta_allowed_emails b
    WHERE b.email = v_email
  );
END;
$$;
