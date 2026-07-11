-- Security hardening (audit P-1): block admin -> owner takeover.
--
-- Ownership is defined two ways in this schema, and the RLS UPDATE policies
-- (groups_update_owner_admin, group_members_update_admin) let any *admin* write
-- both without a column guard:
--   * public.is_group_owner() keys off group_members.role = 'owner'
--   * the billing edge functions authorise off groups.owner_id
-- So an admin could set their own group_members.role = 'owner', or reassign
-- groups.owner_id to themselves, and take the group over (and, on Cloud, the
-- subscription). These BEFORE UPDATE triggers close both vectors. They are
-- surgical: only the *grant of* owner (or an owner_id change) by a non-owner is
-- blocked. Normal admin work (promote member<->admin, approve/remove members,
-- edit group settings) and owner-initiated transfers are unaffected. Service
-- role / internal writes bypass, matching guard_groups_billing_columns (0019).

-- ---------------------------------------------------------------------------
-- groups.owner_id — only the current owner may reassign it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_groups_owner_column()
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

  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT public.is_group_owner(OLD.id) THEN
    RAISE EXCEPTION 'Only the current owner can transfer group ownership';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_guard_owner_column ON public.groups;

CREATE TRIGGER groups_guard_owner_column
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_groups_owner_column();

-- ---------------------------------------------------------------------------
-- group_members.role — only the current owner may grant the 'owner' role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_member_owner_role()
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

  -- Only block *granting* owner. De-escalation (owner -> member on rejoin) and
  -- ordinary member/admin role changes are allowed.
  IF NEW.role = 'owner'
     AND OLD.role IS DISTINCT FROM 'owner'
     AND NOT public.is_group_owner(OLD.group_id) THEN
    RAISE EXCEPTION 'Only the current owner can grant the owner role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_members_guard_owner_role ON public.group_members;

CREATE TRIGGER group_members_guard_owner_role
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_member_owner_role();
