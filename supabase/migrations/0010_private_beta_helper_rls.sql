-- Security definer helpers must bypass RLS on allowlist and groups lookup

ALTER TABLE public.beta_allowed_emails DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_valid_invite_code(p_invite_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  RETURN EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.invite_code = lower(trim(p_invite_code))
      AND g.invite_code_enabled = true
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
BEGIN
  PERFORM set_config('row_security', 'off', true);

  RETURN EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.beta_allowed_emails b ON b.email = lower(u.email)
    WHERE u.id = p_uid
  );
END;
$$;
