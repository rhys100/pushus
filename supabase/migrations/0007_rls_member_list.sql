-- Pending members must not see the member list (plan 7.1)

DROP POLICY IF EXISTS group_members_select_self_or_active_peers ON public.group_members;

CREATE POLICY group_members_select_active_members_only
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, 'active'));

-- Members cannot self-promote: only admins/owners may update membership rows
DROP POLICY IF EXISTS group_members_update_admin ON public.group_members;

CREATE POLICY group_members_update_admin
  ON public.group_members
  FOR UPDATE
  TO authenticated
  USING (public.is_group_admin(group_id) OR public.is_group_owner(group_id))
  WITH CHECK (public.is_group_admin(group_id) OR public.is_group_owner(group_id));
