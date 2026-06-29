-- Optional profile name initial + per-viewer member display aliases (Members list)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_initial text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_name_initial_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_name_initial_format
  CHECK (name_initial IS NULL OR name_initial ~ '^[A-Z]$');

CREATE OR REPLACE FUNCTION public.normalize_name_initial(p_initial text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_trimmed text := NULLIF(trim(p_initial), '');
BEGIN
  IF v_trimmed IS NULL THEN
    RETURN NULL;
  END IF;

  IF char_length(v_trimmed) <> 1 OR v_trimmed !~ '^[A-Za-z]$' THEN
    RAISE EXCEPTION 'Name initial must be a single letter';
  END IF;

  RETURN upper(v_trimmed);
END;
$$;

CREATE TABLE IF NOT EXISTS public.member_display_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_display_aliases_unique UNIQUE (viewer_id, group_id, member_user_id),
  CONSTRAINT member_display_aliases_not_self CHECK (viewer_id <> member_user_id),
  CONSTRAINT member_display_aliases_alias_length CHECK (char_length(trim(alias)) BETWEEN 1 AND 40)
);

CREATE INDEX IF NOT EXISTS member_display_aliases_viewer_group_idx
  ON public.member_display_aliases (viewer_id, group_id);

ALTER TABLE public.member_display_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_display_aliases_select_own ON public.member_display_aliases;
CREATE POLICY member_display_aliases_select_own
  ON public.member_display_aliases
  FOR SELECT
  TO authenticated
  USING (viewer_id = auth.uid());

DROP POLICY IF EXISTS member_display_aliases_insert_own ON public.member_display_aliases;
CREATE POLICY member_display_aliases_insert_own
  ON public.member_display_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND viewer_id <> member_user_id
    AND public.is_group_member(group_id, 'active')
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = member_display_aliases.group_id
        AND gm.user_id = member_display_aliases.member_user_id
        AND gm.status = 'active'
    )
  );

DROP POLICY IF EXISTS member_display_aliases_update_own ON public.member_display_aliases;
CREATE POLICY member_display_aliases_update_own
  ON public.member_display_aliases
  FOR UPDATE
  TO authenticated
  USING (viewer_id = auth.uid())
  WITH CHECK (
    viewer_id = auth.uid()
    AND viewer_id <> member_user_id
    AND public.is_group_member(group_id, 'active')
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = member_display_aliases.group_id
        AND gm.user_id = member_display_aliases.member_user_id
        AND gm.status = 'active'
    )
  );

DROP POLICY IF EXISTS member_display_aliases_delete_own ON public.member_display_aliases;
CREATE POLICY member_display_aliases_delete_own
  ON public.member_display_aliases
  FOR DELETE
  TO authenticated
  USING (viewer_id = auth.uid());

DROP FUNCTION IF EXISTS public.complete_onboarding_profile(text, text, text, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding_profile(
  p_display_name text,
  p_avatar_emoji text,
  p_timezone text,
  p_invite_code text DEFAULT NULL,
  p_name_initial text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
BEGIN
  IF char_length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  IF NOT public.user_has_app_access(v_uid, p_invite_code) THEN
    RAISE EXCEPTION
      'PushUS is in private beta. You need an invite link or approved access to continue.';
  END IF;

  UPDATE public.profiles
  SET
    display_name = trim(p_display_name),
    avatar_emoji = COALESCE(NULLIF(trim(p_avatar_emoji), ''), avatar_emoji),
    timezone = COALESCE(NULLIF(trim(p_timezone), ''), timezone),
    name_initial = public.normalize_name_initial(p_name_initial),
    onboarding_completed_at = now(),
    updated_at = now()
  WHERE id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_display_name text,
  p_avatar_emoji text,
  p_timezone text,
  p_name_initial text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
BEGIN
  IF char_length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  IF NOT public.user_has_app_access(v_uid, NULL) THEN
    RAISE EXCEPTION
      'PushUS is in private beta. You need an invite link or approved access to continue.';
  END IF;

  UPDATE public.profiles
  SET
    display_name = trim(p_display_name),
    avatar_emoji = COALESCE(NULLIF(trim(p_avatar_emoji), ''), avatar_emoji),
    timezone = COALESCE(NULLIF(trim(p_timezone), ''), timezone),
    name_initial = public.normalize_name_initial(p_name_initial),
    updated_at = now()
  WHERE id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_member_alias(
  p_group_id uuid,
  p_member_user_id uuid,
  p_alias text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := public.assert_authenticated();
  v_alias text := NULLIF(trim(p_alias), '');
BEGIN
  IF v_uid = p_member_user_id THEN
    RAISE EXCEPTION 'You cannot set an alias for yourself';
  END IF;

  IF NOT public.is_group_member(p_group_id, 'active') THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = p_member_user_id
      AND gm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Member not found in this group';
  END IF;

  IF v_alias IS NULL THEN
    DELETE FROM public.member_display_aliases
    WHERE viewer_id = v_uid
      AND group_id = p_group_id
      AND member_user_id = p_member_user_id;
    RETURN;
  END IF;

  IF char_length(v_alias) > 40 THEN
    RAISE EXCEPTION 'Alias must be 40 characters or fewer';
  END IF;

  INSERT INTO public.member_display_aliases (viewer_id, group_id, member_user_id, alias)
  VALUES (v_uid, p_group_id, p_member_user_id, v_alias)
  ON CONFLICT (viewer_id, group_id, member_user_id)
  DO UPDATE SET
    alias = EXCLUDED.alias,
    updated_at = now();
END;
$$;

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
          'viewer_alias', mda.alias,
          'profiles', jsonb_build_object(
            'display_name', p.display_name,
            'avatar_emoji', p.avatar_emoji,
            'avatar_color', p.avatar_color,
            'name_initial', p.name_initial
          )
        )
        ORDER BY gm.joined_at NULLS LAST, gm.created_at
      ),
      '[]'::jsonb
    )
    FROM public.group_members gm
    JOIN public.profiles p ON p.id = gm.user_id
    LEFT JOIN public.member_display_aliases mda
      ON mda.viewer_id = auth.uid()
      AND mda.group_id = gm.group_id
      AND mda.member_user_id = gm.user_id
    WHERE gm.group_id = p_group_id
      AND gm.status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding_profile(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_member_alias(uuid, uuid, text) TO authenticated;
