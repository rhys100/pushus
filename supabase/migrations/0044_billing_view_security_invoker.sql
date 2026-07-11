-- Security hardening (audit H-1): make the owner-only billing views respect RLS.
--
-- On Postgres 15 a view runs with the privileges of its owner (postgres) unless
-- security_invoker is set, so it BYPASSES the owner-only RLS on the base tables.
-- group_subscriptions_owner and group_availability have no WHERE clause, so any
-- authenticated user could read every group's subscription/billing state. Latent
-- while billing is off (no rows), but must land before Cloud/Stripe goes live.
--
-- Verified safe for the current app:
--   * group_subscriptions_owner is only read by useBilling.ts, filtered by the
--     caller's own group; base policy group_subscriptions_select_owner then
--     scopes it to groups the caller owns.
--   * group_availability is not referenced by the frontend at all.
--
-- deployment_settings_public is intentionally left as a definer view: its base
-- table (deployment_settings) is deny-all to clients, so security_invoker would
-- return zero rows and break deployment-settings loading. It only ever exposes
-- three non-sensitive columns, so it is not a leak.

ALTER VIEW public.group_subscriptions_owner SET (security_invoker = true);
ALTER VIEW public.group_availability SET (security_invoker = true);
