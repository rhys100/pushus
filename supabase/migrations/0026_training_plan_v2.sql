-- Training plan v2: observed max, progression log, max check-in entries, idempotency fields

ALTER TABLE public.user_training_plans
  ADD COLUMN IF NOT EXISTS observed_max_clean smallint,
  ADD COLUMN IF NOT EXISTS observed_max_clean_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_max_clean_update smallint,
  ADD COLUMN IF NOT EXISTS soreness_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS wizard_soreness_level text,
  ADD COLUMN IF NOT EXISTS week_one_baseline_at_start numeric(4, 2),
  ADD COLUMN IF NOT EXISTS week_one_last_adjusted_at date,
  ADD COLUMN IF NOT EXISTS progression_sync_key text,
  ADD COLUMN IF NOT EXISTS effort_prompted_for date;

ALTER TABLE public.pushup_entries
  ADD COLUMN IF NOT EXISTS is_max_checkin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effort_rating text;

CREATE TABLE IF NOT EXISTS public.training_plan_progression_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  before_baseline numeric(4, 2),
  after_baseline numeric(4, 2),
  before_max_clean smallint,
  after_max_clean smallint,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_plan_progression_log_user_group_idx
  ON public.training_plan_progression_log (user_id, group_id, created_at DESC);

ALTER TABLE public.training_plan_progression_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_plan_progression_log_select_self
  ON public.training_plan_progression_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY training_plan_progression_log_insert_self
  ON public.training_plan_progression_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.training_plan_progression_log TO authenticated;

-- Extend bank_pushups with optional max check-in flag
CREATE OR REPLACE FUNCTION public.bank_pushups(
  p_group_id uuid,
  p_count integer,
  p_logged_for date DEFAULT NULL,
  p_is_max_checkin boolean DEFAULT false
)
RETURNS public.pushup_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_group_writable(p_group_id);
  v_today date := public.group_local_date(p_group_id);
  v_logged_for date := COALESCE(p_logged_for, v_today);
  v_review entry_review_status;
  v_entry public.pushup_entries;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RAISE EXCEPTION 'Count must be greater than zero';
  END IF;

  IF NOT public.is_backdate_allowed(p_group_id, v_logged_for) THEN
    RAISE EXCEPTION 'Backdating not allowed for this group';
  END IF;

  v_review := public.resolve_oversize_review_status(p_group_id, p_count);

  INSERT INTO public.pushup_entries (
    group_id,
    user_id,
    count,
    logged_for,
    logged_at,
    is_backdated,
    review_status,
    source,
    is_max_checkin
  )
  VALUES (
    p_group_id,
    v_uid,
    p_count,
    v_logged_for,
    now(),
    v_logged_for <> v_today,
    v_review,
    'circle_logger',
    COALESCE(p_is_max_checkin, false)
  )
  RETURNING * INTO v_entry;

  PERFORM public.write_entry_audit(
    v_entry.id,
    p_group_id,
    v_uid,
    'create',
    NULL,
    public.entry_to_jsonb(v_entry)
  );

  PERFORM public.award_xp_for_entry(v_entry);

  IF COALESCE(p_is_max_checkin, false) THEN
    UPDATE public.user_training_plans
    SET
      observed_max_clean = p_count,
      observed_max_clean_at = now(),
      pending_max_clean_update = CASE
        WHEN p_count > max_clean_set THEN p_count
        ELSE pending_max_clean_update
      END,
      updated_at = now()
    WHERE user_id = v_uid
      AND group_id = p_group_id
      AND wizard_completed = true;
  END IF;

  RETURN v_entry;
END;
$$;
