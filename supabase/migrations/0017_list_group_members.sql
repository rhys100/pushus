-- Active members list for group page (bypasses brittle client-side embed + RLS)

CREATE OR REPLACE FUNCTION public.list_group_members(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  RETURN (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', gm.id,
          'group_id', gm.group_id,
          'user_id', gm.user_id,
          'role', gm.role,
          'status', gm.status,
          'joined_at', gm.joined_at,
          'created_at', gm.created_at,
          'updated_at', gm.updated_at,
          'profiles', jsonb_build_object(
            'display_name', p.display_name,
            'avatar_emoji', p.avatar_emoji,
            'avatar_color', p.avatar_color
          )
        )
        ORDER BY gm.joined_at NULLS LAST, gm.created_at
      ),
      '[]'::jsonb
    )
    FROM public.group_members gm
    JOIN public.profiles p ON p.id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND gm.status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_group_members(uuid) TO authenticated;
