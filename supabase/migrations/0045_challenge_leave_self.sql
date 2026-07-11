-- Let a member leave a challenge they joined.
--
-- Joining is a direct, self-scoped client write on these tables (0004:
-- competition_participants_insert_self / challenge_team_members_insert_self),
-- but there was no matching DELETE policy — so a client "leave" delete matched
-- zero rows under RLS and always failed. These policies are the exact symmetric
-- counterpart: a caller may delete only their OWN participant / team-member row,
-- and only while an active member of the challenge's group. No RPC is introduced
-- because join itself is not RPC-mediated on these tables. GRANT DELETE is
-- already present (0004).

CREATE POLICY competition_participants_delete_self
  ON public.competition_participants
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.competitions c
      WHERE c.id = competition_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );

CREATE POLICY challenge_team_members_delete_self
  ON public.challenge_team_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.challenge_teams ct
      JOIN public.competitions c ON c.id = ct.competition_id
      WHERE ct.id = team_id
        AND public.is_group_member(c.group_id, 'active')
    )
  );
