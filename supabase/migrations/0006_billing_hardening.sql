-- PushUS billing hardening — fix override lookup, write gate, service_role grants

-- ---------------------------------------------------------------------------
-- Fix override helper usage (assignment, not invalid FROM alias)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.group_billing_status(p_group_id uuid)
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
  v_status := public.group_billing_status(p_group_id);

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

-- Tables created after 0002 bulk grants need explicit service_role access
GRANT ALL ON public.deployment_settings TO service_role;
GRANT ALL ON public.billing_customers TO service_role;
GRANT ALL ON public.group_subscriptions TO service_role;
GRANT ALL ON public.billing_events TO service_role;
GRANT ALL ON public.subscription_overrides TO service_role;

GRANT EXECUTE ON FUNCTION public.active_subscription_override(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_past_due_in_grace(uuid) TO authenticated, service_role;
