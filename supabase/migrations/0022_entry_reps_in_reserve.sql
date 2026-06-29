-- Per-set effort feedback (reps in reserve) for training plan auto-tuning

ALTER TABLE public.pushup_entries
  ADD COLUMN IF NOT EXISTS reps_in_reserve smallint
    CHECK (reps_in_reserve IS NULL OR (reps_in_reserve >= 0 AND reps_in_reserve <= 10));

COMMENT ON COLUMN public.pushup_entries.reps_in_reserve IS
  'How many more reps the user could have done after this bank (NULL = skipped or not asked).';

CREATE OR REPLACE FUNCTION public.entry_to_jsonb(p_entry public.pushup_entries)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_entry.id,
    'group_id', p_entry.group_id,
    'user_id', p_entry.user_id,
    'count', p_entry.count,
    'logged_for', p_entry.logged_for,
    'logged_at', p_entry.logged_at,
    'is_backdated', p_entry.is_backdated,
    'review_status', p_entry.review_status,
    'source', p_entry.source,
    'reps_in_reserve', p_entry.reps_in_reserve,
    'deleted_at', p_entry.deleted_at,
    'created_at', p_entry.created_at,
    'updated_at', p_entry.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.record_entry_effort(
  p_entry_id uuid,
  p_reps_in_reserve smallint
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
  v_today date;
BEGIN
  IF p_reps_in_reserve IS NULL OR p_reps_in_reserve < 0 OR p_reps_in_reserve > 10 THEN
    RAISE EXCEPTION 'Reps in reserve must be between 0 and 10';
  END IF;

  SELECT *
  INTO v_before
  FROM public.pushup_entries pe
  WHERE pe.id = p_entry_id
  FOR UPDATE;

  IF v_before.id IS NULL OR v_before.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;

  IF v_before.user_id <> v_uid THEN
    RAISE EXCEPTION 'Not allowed to record effort on this entry';
  END IF;

  PERFORM public.assert_group_writable(v_before.group_id);

  IF NOT public.is_group_member(v_before.group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  v_today := public.group_local_date(v_before.group_id);
  IF v_before.logged_for <> v_today THEN
    RAISE EXCEPTION 'Same-day effort recording only';
  END IF;

  UPDATE public.pushup_entries
  SET
    reps_in_reserve = p_reps_in_reserve,
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

GRANT EXECUTE ON FUNCTION public.record_entry_effort(uuid, smallint) TO authenticated;
