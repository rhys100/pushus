-- Let members edit (not just today) within the group's backdate window.
--
-- Background: 0002 hard-coded members to "same-day edit only" — any entry whose
-- logged_for was not today raised "Same-day edit only for members". But adding
-- entries already honours the group's `backdate_policy` (default 'today_yesterday')
-- via is_backdate_allowed, so a member could bank for yesterday yet not correct a
-- yesterday typo. This aligns EDIT permission with the same policy that governs
-- ADD: you can fix any entry inside the backdate window, older days stay locked.
--
-- Product decision (docs/product-decisions.md): members may add + edit their own
-- entries for today and yesterday; older days are locked. DELETE stays same-day
-- for members (see delete_pushup_entry — intentionally unchanged). Admins keep the
-- existing bypass on both.

CREATE OR REPLACE FUNCTION public.update_pushup_entry(
  p_entry_id uuid,
  p_count integer
)
RETURNS public.pushup_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_before public.pushup_entries;
  v_after public.pushup_entries;
  v_review entry_review_status;
BEGIN
  SELECT *
  INTO v_before
  FROM public.pushup_entries pe
  WHERE pe.id = p_entry_id
  FOR UPDATE;

  IF v_before.id IS NULL OR v_before.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  PERFORM public.assert_group_writable(v_before.group_id);

  IF NOT public.is_group_member(v_before.group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF v_before.user_id <> v_uid AND NOT public.is_group_admin(v_before.group_id) THEN
    RAISE EXCEPTION 'Not allowed to edit this entry';
  END IF;

  IF v_before.user_id = v_uid AND NOT public.is_group_admin(v_before.group_id) THEN
    -- Members may edit within the group's backdate window (today + yesterday by
    -- default); admins bypass. is_backdate_allowed compares logged_for against the
    -- group's backdate_policy, so 'same_day' groups still get today-only.
    IF NOT public.is_backdate_allowed(v_before.group_id, v_before.logged_for) THEN
      RAISE EXCEPTION 'That day is locked — you can only edit today or yesterday''s entries';
    END IF;

    -- Don't let a member self-edit around an admin moderation decision. Editing
    -- recomputes review_status from the count, so without this guard a member
    -- could shrink a 'rejected' (or still-'pending') entry back under the cap,
    -- flip it to 'none', and have it silently count again — and the admin could
    -- not re-reject it (review_entry requires 'pending'). Widening edits to
    -- yesterday newly exposed this the day after an oversize review. Admins bypass.
    IF v_before.review_status IN ('pending_review', 'rejected') THEN
      RAISE EXCEPTION 'This entry is under admin review and can''t be edited';
    END IF;
  END IF;

  IF p_count IS NULL OR p_count <= 0 THEN
    RAISE EXCEPTION 'Count must be greater than zero';
  END IF;

  v_review := public.resolve_oversize_review_status(v_before.group_id, p_count);

  UPDATE public.pushup_entries
  SET
    count = p_count,
    review_status = v_review,
    source = 'manual_edit',
    updated_at = now()
  WHERE id = v_before.id
  RETURNING * INTO v_after;

  PERFORM public.write_entry_audit(
    v_after.id,
    v_after.group_id,
    v_uid,
    'update',
    public.entry_to_jsonb(v_before),
    public.entry_to_jsonb(v_after)
  );

  RETURN v_after;
END;
$$;
