-- Security hardening (audit BL-1): make guest rep import one-time, capped, and
-- policy-respecting.
--
-- The original import_guest_reps (0039) was documented as a one-time self-import
-- but nothing enforced it: it could be called repeatedly, wrote review_status
-- 'none' unconditionally (bypassing the group's oversize block/admin_review
-- policy), and accepted an unbounded array. A member could therefore fabricate
-- effectively unlimited backdated reps -> XP, leaderboard totals and badges.
--
-- This migration adds a claim table to enforce one import per (user, group),
-- caps the payload, and routes each imported count through
-- resolve_oversize_review_status so oversize imports obey the group policy.

-- ---------------------------------------------------------------------------
-- One-time claim marker. No grants + RLS enabled with no policy => clients
-- cannot read or write it; only the SECURITY DEFINER RPC below (owner) touches
-- it. A failed import rolls back the claim in the same transaction, so a genuine
-- error does not consume the one-time slot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_import_claims (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE public.guest_import_claims ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Hardened import
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_guest_reps(p_group_id uuid, p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  today date;
  imported integer := 0;
  total bigint := 0;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'entries must be a JSON array';
  END IF;

  IF jsonb_array_length(p_entries) > 60 THEN
    RAISE EXCEPTION 'Too many entries (max 60)';
  END IF;

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF NOT public.can_group_write(p_group_id) THEN
    RAISE EXCEPTION 'Group is read-only';
  END IF;

  -- One import per user + group. Claim the slot atomically; a duplicate leaves
  -- FOUND false (ON CONFLICT DO NOTHING) and we refuse.
  INSERT INTO public.guest_import_claims (user_id, group_id)
  VALUES (caller, p_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest reps have already been imported for this group';
  END IF;

  today := public.group_local_date(p_group_id);

  WITH parsed AS (
    SELECT LEAST(GREATEST(e.count, 1), 1000) AS count, e.day
    FROM jsonb_to_recordset(p_entries) AS e(count integer, day date)
    -- Guard: positive counts, no future dates, nothing absurdly old.
    WHERE e.count > 0 AND e.day IS NOT NULL AND e.day <= today AND e.day >= today - 60
  ),
  ins AS (
    INSERT INTO public.pushup_entries
      (group_id, user_id, count, logged_for, is_backdated, source, review_status)
    SELECT
      p_group_id,
      caller,
      parsed.count,
      parsed.day,
      parsed.day < today,
      'manual_edit'::public.entry_source,
      -- Respect the group's oversize policy instead of hard-coding 'none'.
      public.resolve_oversize_review_status(p_group_id, parsed.count)
    FROM parsed
    RETURNING count
  )
  SELECT count(*), COALESCE(sum(count), 0) INTO imported, total FROM ins;

  RETURN jsonb_build_object('imported', imported, 'total', total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_guest_reps(uuid, jsonb) TO authenticated;
