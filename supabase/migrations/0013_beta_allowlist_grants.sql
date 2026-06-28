-- Service role manages beta allowlist; clients use SECURITY DEFINER RPC checks only

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_allowed_emails TO service_role;

REVOKE ALL ON public.beta_allowed_emails FROM anon, authenticated;
