-- PushUS Slice 1A — core schema
-- Tables: profiles, groups, group_members, group_join_requests, pushup_entries,
--         pushup_entry_audit_log, reactions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE billing_status AS ENUM (
  'exempt',
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'read_only',
  'canceled'
);

CREATE TYPE member_role AS ENUM (
  'owner',
  'admin',
  'member'
);

CREATE TYPE member_status AS ENUM (
  'pending',
  'active',
  'removed',
  'left'
);

CREATE TYPE join_request_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE backdate_policy AS ENUM (
  'same_day',
  'today_yesterday',
  'this_week'
);

CREATE TYPE oversize_entry_policy AS ENUM (
  'warn',
  'block',
  'admin_review'
);

CREATE TYPE feed_visibility AS ENUM (
  'full_entries',
  'daily_totals',
  'leaderboard_totals'
);

CREATE TYPE entry_review_status AS ENUM (
  'none',
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE entry_source AS ENUM (
  'circle_logger',
  'manual_edit'
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'undo',
  'admin_adjust'
);

CREATE TYPE reaction_target_type AS ENUM (
  'entry',
  'daily_total',
  'feed_event'
);

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '💪',
  avatar_color text NOT NULL DEFAULT '#FF6B35',
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile when a new auth user is registered
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      split_part(NEW.email, '@', 1),
      'PushUS user'
    ),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'timezone'), ''), 'UTC')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  timezone text NOT NULL DEFAULT 'UTC',
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  max_members integer NOT NULL DEFAULT 30 CHECK (max_members > 0),
  default_invite_limit integer NOT NULL DEFAULT 3 CHECK (default_invite_limit >= 0),
  max_single_entry integer NOT NULL DEFAULT 100 CHECK (max_single_entry > 0),
  backdate_policy backdate_policy NOT NULL DEFAULT 'today_yesterday',
  oversize_entry_policy oversize_entry_policy NOT NULL DEFAULT 'warn',
  feed_visibility feed_visibility NOT NULL DEFAULT 'full_entries',
  invite_code text NOT NULL UNIQUE DEFAULT public.generate_invite_code(),
  invite_code_enabled boolean NOT NULL DEFAULT true,
  billing_status billing_status NOT NULL DEFAULT 'exempt',
  checkout_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX groups_owner_id_idx ON public.groups (owner_id);
CREATE INDEX groups_billing_status_idx ON public.groups (billing_status);

CREATE TRIGGER groups_set_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'pending',
  referred_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  invite_slots_override integer CHECK (invite_slots_override IS NULL OR invite_slots_override >= 0),
  joined_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX group_members_group_id_status_idx
  ON public.group_members (group_id, status);

CREATE INDEX group_members_user_id_status_idx
  ON public.group_members (user_id, status);

CREATE TRIGGER group_members_set_updated_at
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- group_join_requests
-- ---------------------------------------------------------------------------

CREATE TABLE public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  referred_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  invite_code text,
  status join_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_join_requests_group_id_status_idx
  ON public.group_join_requests (group_id, status);

CREATE INDEX group_join_requests_user_id_status_idx
  ON public.group_join_requests (user_id, status);

CREATE UNIQUE INDEX group_join_requests_one_pending_per_user_group_idx
  ON public.group_join_requests (group_id, user_id)
  WHERE status = 'pending';

CREATE TRIGGER group_join_requests_set_updated_at
  BEFORE UPDATE ON public.group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pushup_entries
-- ---------------------------------------------------------------------------

CREATE TABLE public.pushup_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  count integer NOT NULL CHECK (count > 0),
  logged_for date NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  is_backdated boolean NOT NULL DEFAULT false,
  review_status entry_review_status NOT NULL DEFAULT 'none',
  source entry_source NOT NULL DEFAULT 'circle_logger',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pushup_entries_group_id_logged_for_idx
  ON public.pushup_entries (group_id, logged_for)
  WHERE deleted_at IS NULL;

CREATE INDEX pushup_entries_group_id_user_id_logged_for_idx
  ON public.pushup_entries (group_id, user_id, logged_for)
  WHERE deleted_at IS NULL;

CREATE INDEX pushup_entries_user_id_created_at_desc_idx
  ON public.pushup_entries (user_id, created_at DESC);

CREATE INDEX pushup_entries_group_id_created_at_desc_idx
  ON public.pushup_entries (group_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER pushup_entries_set_updated_at
  BEFORE UPDATE ON public.pushup_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pushup_entry_audit_log (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE public.pushup_entry_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES public.pushup_entries (id) ON DELETE SET NULL,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  action audit_action NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pushup_entry_audit_log_group_id_created_at_idx
  ON public.pushup_entry_audit_log (group_id, created_at DESC);

CREATE INDEX pushup_entry_audit_log_entry_id_idx
  ON public.pushup_entry_audit_log (entry_id);

-- ---------------------------------------------------------------------------
-- reactions
-- ---------------------------------------------------------------------------

CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  target_type reaction_target_type NOT NULL,
  target_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(trim(emoji)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, user_id, emoji)
);

CREATE INDEX reactions_group_id_target_idx
  ON public.reactions (group_id, target_type, target_id);

CREATE INDEX reactions_user_id_idx
  ON public.reactions (user_id);
