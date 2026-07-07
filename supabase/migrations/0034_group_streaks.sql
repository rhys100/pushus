-- Active streaks for every active member of a group, so the Board can show
-- streak flames. Uses compute_active_streak_days (0031), which already
-- honours group rest days and each member's used streak freezes — freezes are
-- not directly readable across members under RLS, which is why this is an RPC
-- rather than a client-side calculation.

CREATE OR REPLACE FUNCTION public.group_active_streaks(p_group_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT public.is_group_member(p_group_id, 'active') THEN '[]'::jsonb
    ELSE COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', gm.user_id,
        'streak', public.compute_active_streak_days(
          gm.user_id,
          p_group_id,
          public.group_local_date(p_group_id)
        )
      ))
      FROM public.group_members gm
      WHERE gm.group_id = p_group_id
        AND gm.status = 'active'
    ), '[]'::jsonb)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.group_active_streaks(uuid) TO authenticated;
