-- Guest rep import: when someone plays as a guest (reps in browser localStorage)
-- then signs up and joins a group, let them carry those reps in. Imported to
-- their original local days so history / streak / XP reflect the real effort.
-- One-time self-import, so it bypasses the group's backdate policy and the
-- oversize entry check (guest sets are the user's own honest reps). Late-joiner
-- leaderboard fairness is already handled by the since-you-joined view + the
-- official-period rules.

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

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF NOT public.can_group_write(p_group_id) THEN
    RAISE EXCEPTION 'Group is read-only';
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
    SELECT p_group_id, caller, parsed.count, parsed.day, parsed.day < today,
           'manual_edit'::public.entry_source, 'none'::public.entry_review_status
    FROM parsed
    RETURNING count
  )
  SELECT count(*), COALESCE(sum(count), 0) INTO imported, total FROM ins;

  RETURN jsonb_build_object('imported', imported, 'total', total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_guest_reps(uuid, jsonb) TO authenticated;
