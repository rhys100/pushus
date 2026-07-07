-- Admin dodgy-entry management: list entries held for review (oversize policy
-- 'admin_review' sets review_status = 'pending') and approve/reject them.
-- Rejected entries stop counting everywhere (feed, leaderboard, XP — the XP
-- trigger from 0031 handles the review_status change automatically).

CREATE OR REPLACE FUNCTION public.list_pending_entries(p_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT public.is_group_admin(p_group_id) THEN
      jsonb_build_object('error', 'admin_required')
    ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pe.id,
        'user_id', pe.user_id,
        'display_name', p.display_name,
        'avatar_emoji', p.avatar_emoji,
        'count', pe.count,
        'logged_for', pe.logged_for,
        'created_at', pe.created_at
      ) ORDER BY pe.created_at DESC)
      FROM public.pushup_entries pe
      JOIN public.profiles p ON p.id = pe.user_id
      WHERE pe.group_id = p_group_id
        AND pe.deleted_at IS NULL
        AND pe.review_status = 'pending'
    ), '[]'::jsonb)
  END;
$$;

CREATE OR REPLACE FUNCTION public.review_entry(p_entry_id uuid, p_approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry public.pushup_entries;
BEGIN
  SELECT * INTO v_entry FROM public.pushup_entries WHERE id = p_entry_id;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  IF NOT public.is_group_admin(v_entry.group_id) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF v_entry.review_status <> 'pending' THEN
    RAISE EXCEPTION 'Entry is not awaiting review';
  END IF;

  UPDATE public.pushup_entries
  SET review_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END::public.entry_review_status
  WHERE id = p_entry_id;

  PERFORM public.write_entry_audit(
    p_entry_id,
    v_entry.group_id,
    auth.uid(),
    'update',
    jsonb_build_object('review_status', v_entry.review_status),
    jsonb_build_object('review_status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_entries(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_entry(uuid, boolean) TO authenticated;
