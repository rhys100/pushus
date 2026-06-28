-- Owners/admins must read pending join requester profiles for the admin UI embed

DROP POLICY IF EXISTS profiles_select_self_or_shared_group ON public.profiles;

CREATE POLICY profiles_select_self_or_shared_group
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.group_members self_membership
      JOIN public.group_members peer_membership
        ON peer_membership.group_id = self_membership.group_id
      WHERE self_membership.user_id = auth.uid()
        AND self_membership.status = 'active'
        AND peer_membership.user_id = profiles.id
        AND peer_membership.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_join_requests gjr
      WHERE gjr.user_id = profiles.id
        AND gjr.status = 'pending'
        AND (
          public.is_group_admin(gjr.group_id)
          OR public.is_group_owner(gjr.group_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.list_pending_join_requests(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_group_admin(p_group_id)
    OR public.is_group_owner(p_group_id)
  ) THEN
    RAISE EXCEPTION 'Admin or owner required';
  END IF;

  RETURN (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', gjr.id,
          'group_id', gjr.group_id,
          'user_id', gjr.user_id,
          'status', gjr.status,
          'created_at', gjr.created_at,
          'profiles', jsonb_build_object(
            'display_name', p.display_name,
            'avatar_emoji', p.avatar_emoji,
            'avatar_color', p.avatar_color
          )
        )
        ORDER BY gjr.created_at
      ),
      '[]'::jsonb
    )
    FROM public.group_join_requests gjr
    JOIN public.profiles p ON p.id = gjr.user_id
    WHERE gjr.group_id = p_group_id
      AND gjr.status = 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_join_requests(uuid) TO authenticated;
