-- PushUS Slice 1B — billing tables, helpers, RLS, and extended write gate

-- ---------------------------------------------------------------------------
-- deployment_settings (singleton)
-- ---------------------------------------------------------------------------

CREATE TABLE public.deployment_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  deployment_mode text NOT NULL DEFAULT 'community'
    CHECK (deployment_mode IN ('community', 'cloud')),
  billing_enabled boolean NOT NULL DEFAULT false,
  default_billing_grace_days integer NOT NULL DEFAULT 7
    CHECK (default_billing_grace_days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deployment_settings_singleton CHECK (
    id = '00000000-0000-0000-0000-000000000001'::uuid
  )
);

CREATE TRIGGER deployment_settings_set_updated_at
  BEFORE UPDATE ON public.deployment_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.deployment_settings (
  id,
  deployment_mode,
  billing_enabled,
  default_billing_grace_days
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'community',
  false,
  7
);

CREATE VIEW public.deployment_settings_public AS
SELECT
  deployment_mode,
  billing_enabled,
  default_billing_grace_days
FROM public.deployment_settings;

-- ---------------------------------------------------------------------------
-- billing_customers
-- ---------------------------------------------------------------------------

CREATE TABLE public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL UNIQUE REFERENCES public.groups (id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_customers_owner_id_idx ON public.billing_customers (owner_id);

CREATE TRIGGER billing_customers_set_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- group_subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE public.group_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL UNIQUE REFERENCES public.groups (id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  plan_interval text CHECK (plan_interval IS NULL OR plan_interval IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    )),
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  past_due_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_subscriptions_stripe_customer_id_idx
  ON public.group_subscriptions (stripe_customer_id);

CREATE TRIGGER group_subscriptions_set_updated_at
  BEFORE UPDATE ON public.group_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- billing_events (idempotent webhook processing)
-- ---------------------------------------------------------------------------

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  stripe_object_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processed', 'failed')),
  processed_at timestamptz,
  error_message text,
  debug_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_events_event_type_idx ON public.billing_events (event_type);

-- ---------------------------------------------------------------------------
-- subscription_overrides
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscription_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  override_status text NOT NULL
    CHECK (override_status IN ('active', 'trialing', 'billing_exempt', 'blocked')),
  reason text,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_overrides_group_id_idx
  ON public.subscription_overrides (group_id);

-- ---------------------------------------------------------------------------
-- Billing helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_deployment_settings()
RETURNS TABLE (
  deployment_mode text,
  billing_enabled boolean,
  default_billing_grace_days integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ds.deployment_mode,
    ds.billing_enabled,
    ds.default_billing_grace_days
  FROM public.deployment_settings ds
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.active_subscription_override(p_group_id uuid)
RETURNS public.subscription_overrides
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT so.*
  FROM public.subscription_overrides so
  WHERE so.group_id = p_group_id
    AND (so.expires_at IS NULL OR so.expires_at > now())
  ORDER BY so.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_past_due_in_grace(p_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grace_days integer;
  v_sub public.group_subscriptions%ROWTYPE;
BEGIN
  SELECT ds.default_billing_grace_days
  INTO v_grace_days
  FROM public.deployment_settings ds
  LIMIT 1;

  v_grace_days := COALESCE(v_grace_days, 7);

  SELECT gs.*
  INTO v_sub
  FROM public.group_subscriptions gs
  WHERE gs.group_id = p_group_id;

  IF v_sub.id IS NULL OR v_sub.status <> 'past_due' THEN
    RETURN false;
  END IF;

  IF v_sub.past_due_since IS NULL THEN
    RETURN true;
  END IF;

  RETURN now() <= v_sub.past_due_since + (v_grace_days || ' days')::interval;
END;
$$;

CREATE OR REPLACE FUNCTION public.group_billing_status(p_group_id uuid)
RETURNS billing_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.groups%ROWTYPE;
  v_override public.subscription_overrides%ROWTYPE;
  v_sub public.group_subscriptions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_group
  FROM public.groups g
  WHERE g.id = p_group_id;

  IF v_group.id IS NULL THEN
    RETURN 'read_only';
  END IF;

  SELECT *
  INTO v_override
  FROM public.active_subscription_override(p_group_id) so;

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
  v_override public.subscription_overrides%ROWTYPE;
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

  SELECT *
  INTO v_override
  FROM public.active_subscription_override(p_group_id) so;

  IF v_override.id IS NOT NULL
    AND v_override.override_status IN ('billing_exempt', 'trialing', 'active') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_group — respect deployment_settings.billing_enabled
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Public / owner-safe views (after billing helpers)
-- ---------------------------------------------------------------------------

CREATE VIEW public.group_subscriptions_owner AS
SELECT
  gs.group_id,
  gs.plan_interval,
  gs.status,
  gs.trial_start,
  gs.trial_end,
  gs.current_period_start,
  gs.current_period_end,
  gs.cancel_at_period_end,
  gs.canceled_at,
  gs.past_due_since,
  gs.created_at,
  gs.updated_at
FROM public.group_subscriptions gs;

CREATE VIEW public.group_availability AS
SELECT
  g.id AS group_id,
  public.group_billing_status(g.id) AS billing_status,
  public.can_group_write(g.id) AS can_write
FROM public.groups g;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.deployment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_overrides ENABLE ROW LEVEL SECURITY;

-- deployment_settings: no direct client access; use view/RPC
CREATE POLICY deployment_settings_deny_all
  ON public.deployment_settings
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- billing_customers: owner read only
CREATE POLICY billing_customers_select_owner
  ON public.billing_customers
  FOR SELECT
  TO authenticated
  USING (public.is_group_owner(group_id));

-- group_subscriptions: owner read only (Stripe IDs hidden via owner view in app)
CREATE POLICY group_subscriptions_select_owner
  ON public.group_subscriptions
  FOR SELECT
  TO authenticated
  USING (public.is_group_owner(group_id));

-- billing_events: deny all client access
CREATE POLICY billing_events_deny_all
  ON public.billing_events
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- subscription_overrides: owner read only
CREATE POLICY subscription_overrides_select_owner
  ON public.subscription_overrides
  FOR SELECT
  TO authenticated
  USING (public.is_group_owner(group_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.deployment_settings_public TO anon, authenticated;
GRANT SELECT ON public.group_subscriptions_owner TO authenticated;
GRANT SELECT ON public.group_availability TO authenticated;

GRANT SELECT ON public.billing_customers TO authenticated;
GRANT SELECT ON public.group_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_overrides TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_deployment_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.group_billing_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_group_write(uuid) TO authenticated;
