-- Block self-reactions on push-up entries.
-- Users may react to mates' entries only.

DELETE FROM public.reactions r
USING public.pushup_entries pe
WHERE r.target_type = 'entry'
  AND pe.id = r.target_id
  AND pe.user_id = r.user_id;

DROP POLICY IF EXISTS reactions_insert_active_members ON public.reactions;

CREATE POLICY reactions_insert_active_members
  ON public.reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_group_member(group_id, 'active')
    AND public.can_group_write(group_id)
    AND (
      target_type <> 'entry'
      OR NOT EXISTS (
        SELECT 1
        FROM public.pushup_entries pe
        WHERE pe.id = target_id
          AND pe.user_id = auth.uid()
          AND pe.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS reactions_update_own ON public.reactions;

CREATE POLICY reactions_update_own
  ON public.reactions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      target_type <> 'entry'
      OR NOT EXISTS (
        SELECT 1
        FROM public.pushup_entries pe
        WHERE pe.id = target_id
          AND pe.user_id = auth.uid()
          AND pe.deleted_at IS NULL
      )
    )
  );
