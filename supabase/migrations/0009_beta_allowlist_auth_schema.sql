-- Fix beta allowlist lookup against auth.users

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
