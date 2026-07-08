-- Overage override: a member can bank past the calm warning cap after a
-- confirmation. Record that acknowledgement on the entry (locked rule: "user
-- can record override after calm confirmation above warning cap"). Not a block —
-- purely a flag for honesty / later admin insight.

ALTER TABLE public.pushup_entries
  ADD COLUMN is_override boolean NOT NULL DEFAULT false;

-- Flag one of the caller's own entries as an acknowledged overage override.
CREATE OR REPLACE FUNCTION public.mark_entry_override(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  UPDATE public.pushup_entries
  SET is_override = true
  WHERE id = p_entry_id AND user_id = caller AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_entry_override(uuid) TO authenticated;
