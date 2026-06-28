-- PushUS security hardening — billing column guard, RPC lockdown, membership-gated billing reads

-- ---------------------------------------------------------------------------
-- Block authenticated users from tampering with billing-sensitive group columns
-- Runs as invoker (not SECURITY DEFINER) so client updates are checked.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_groups_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF session_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.billing_status IS DISTINCT FROM OLD.billing_status THEN
    RAISE EXCEPTION 'This group setting cannot be changed directly';
  END IF;

  IF NEW.checkout_started_at IS DISTINCT FROM OLD.checkout_started_at THEN
    RAISE EXCEPTION 'This group setting cannot be changed directly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_guard_billing_columns ON public.groups;

CREATE TRIGGER groups_guard_billing_columns
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_groups_billing_columns();

-- ---------------------------------------------------------------------------
-- Restrict cross-tenant override reads to internal callers only
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.active_subscription_override(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.active_subscription_override(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.active_subscription_override(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Internal billing status (no membership gate — used by write/join RPCs)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.group_billing_status_internal(p_group_id uuid)
RETURNS billing_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.groups%ROWTYPE;
  v_override public.subscription_overrides;
  v_sub public.group_subscriptions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_group
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF v_group.id IS NULL THEN
    RETURN 'read_only';
  END IF;

  v_override := public.active_subscription_override(p_group_id);

  IF v_override.id IS NOT NULL THEN
    IF v_override.override_status = 'billing_exempt' THEN
      RETURN 'exempt';
    END IF;

    IF v_override.override_status = 'blocked' THEN
      RETURN 'read_only';
    END IF;

    IF v_override.override_status = 'trialing' THEN
      RETURN 'trialing';
    END IF;

    IF v_override.override_status = 'active' THEN
      RETURN 'active';
    END IF;
  END IF;

  IF v_group.billing_status = 'exempt' THEN
    RETURN 'exempt';
  END IF;

  SELECT gs.*
  INTO v_sub
  FROM public.group_subscriptions gs
  WHERE gs.group_id = p_group_id;

  IF v_sub.id IS NOT NULL THEN
    IF v_sub.status IN ('trialing', 'active') THEN
      RETURN v_sub.status::billing_status;
    END IF;

    IF v_sub.status = 'past_due' THEN
      IF public.is_past_due_in_grace(p_group_id) THEN
        RETURN 'past_due';
      END IF;

      RETURN 'read_only';
    END IF;

    IF v_sub.status = 'canceled' THEN
      IF v_sub.current_period_end IS NOT NULL AND now() <= v_sub.current_period_end THEN
        RETURN 'canceled';
      END IF;

      RETURN 'read_only';
    END IF;

    IF v_sub.status IN ('unpaid', 'incomplete_expired', 'paused') THEN
      RETURN 'read_only';
    END IF;

    IF v_sub.status = 'incomplete' THEN
      RETURN 'incomplete';
    END IF;
  END IF;

  IF v_group.billing_status IN ('incomplete', 'read_only', 'canceled') THEN
    RETURN v_group.billing_status;
  END IF;

  RETURN v_group.billing_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.group_billing_status_internal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_billing_status_internal(uuid) TO service_role;

-- Public RPC: membership-gated (prevents cross-tenant billing enumeration)
CREATE OR REPLACE FUNCTION public.group_billing_status(p_group_id uuid)
RETURNS billing_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'read_only';
  END IF;

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RETURN 'read_only';
  END IF;

  RETURN public.group_billing_status_internal(p_group_id);
END;
$$;

-- Write gate uses internal status so join/bank RPCs work before membership exists
CREATE OR REPLACE FUNCTION public.can_group_write(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status billing_status;
  v_sub public.group_subscriptions%ROWTYPE;
BEGIN
  v_status := public.group_billing_status_internal(p_group_id);

  IF v_status = 'exempt' THEN
    RETURN true;
  END IF;

  IF v_status IN ('trialing', 'active') THEN
    RETURN true;
  END IF;

  IF v_status = 'past_due' THEN
    RETURN public.is_past_due_in_grace(p_group_id);
  END IF;

  IF v_status = 'canceled' THEN
    SELECT gs.*
    INTO v_sub
    FROM public.group_subscriptions gs
    WHERE gs.group_id = p_group_id;

    IF v_sub.id IS NOT NULL
      AND v_sub.current_period_end IS NOT NULL
      AND now() <= v_sub.current_period_end THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  IF v_status IN ('read_only', 'incomplete') THEN
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

-- Membership-gated write check for frontend billing UI
CREATE OR REPLACE FUNCTION public.can_my_group_write(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RETURN false;
  END IF;

  RETURN public.can_group_write(p_group_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_my_group_write(uuid) TO authenticated;
