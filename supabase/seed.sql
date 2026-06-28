-- PushUS demo seed (Slice 1A + 1B Community defaults)
-- Runs after migrations on `supabase db reset`.
-- Demo group "Sunday Crew" — Australia/Sydney, billing_status exempt.
-- deployment_settings (billing_enabled=false) is seeded in 0003_billing.sql.
-- Fixed demo user UUIDs (passwords not used by seed; crypt placeholder only)
-- a1000001 Sam (owner), a1000002 Alex, a1000003 Jordan, a1000004 Casey,
-- a1000005 Riley (pending), a1000006 Morgan

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000001-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'sam@sundaycrew.demo',
    crypt('demo-seed-only', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Sam","timezone":"Australia/Sydney"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000002-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'alex@sundaycrew.demo',
    crypt('demo-seed-only', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Alex","timezone":"Australia/Sydney"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000003-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'jordan@sundaycrew.demo',
    crypt('demo-seed-only', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Jordan","timezone":"Australia/Sydney"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000004-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'casey@sundaycrew.demo',
    crypt('demo-seed-only', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Casey","timezone":"Australia/Sydney"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000005-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'riley@sundaycrew.demo',
    crypt('demo-seed-only', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Riley","timezone":"Australia/Sydney"}',
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000006-0000-4000-8000-000000000006',
    'authenticated',
    'authenticated',
    'morgan@sundaycrew.demo',
    crypt('demo-seed-only', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Morgan","timezone":"Australia/Sydney"}',
    now(),
    now(),
    '', '', '', ''
  );

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    'a1000001-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000001',
    '{"sub":"a1000001-0000-4000-8000-000000000001","email":"sam@sundaycrew.demo"}'::jsonb,
    'email',
    'a1000001-0000-4000-8000-000000000001',
    now(), now(), now()
  ),
  (
    'a1000002-0000-4000-8000-000000000002',
    'a1000002-0000-4000-8000-000000000002',
    '{"sub":"a1000002-0000-4000-8000-000000000002","email":"alex@sundaycrew.demo"}'::jsonb,
    'email',
    'a1000002-0000-4000-8000-000000000002',
    now(), now(), now()
  ),
  (
    'a1000003-0000-4000-8000-000000000003',
    'a1000003-0000-4000-8000-000000000003',
    '{"sub":"a1000003-0000-4000-8000-000000000003","email":"jordan@sundaycrew.demo"}'::jsonb,
    'email',
    'a1000003-0000-4000-8000-000000000003',
    now(), now(), now()
  ),
  (
    'a1000004-0000-4000-8000-000000000004',
    'a1000004-0000-4000-8000-000000000004',
    '{"sub":"a1000004-0000-4000-8000-000000000004","email":"casey@sundaycrew.demo"}'::jsonb,
    'email',
    'a1000004-0000-4000-8000-000000000004',
    now(), now(), now()
  ),
  (
    'a1000005-0000-4000-8000-000000000005',
    'a1000005-0000-4000-8000-000000000005',
    '{"sub":"a1000005-0000-4000-8000-000000000005","email":"riley@sundaycrew.demo"}'::jsonb,
    'email',
    'a1000005-0000-4000-8000-000000000005',
    now(), now(), now()
  ),
  (
    'a1000006-0000-4000-8000-000000000006',
    'a1000006-0000-4000-8000-000000000006',
    '{"sub":"a1000006-0000-4000-8000-000000000006","email":"morgan@sundaycrew.demo"}'::jsonb,
    'email',
    'a1000006-0000-4000-8000-000000000006',
    now(), now(), now()
  );

UPDATE public.profiles SET avatar_emoji = '🏋️', avatar_color = '#FF6B35' WHERE id = 'a1000001-0000-4000-8000-000000000001';
UPDATE public.profiles SET avatar_emoji = '💪', avatar_color = '#4ECDC4' WHERE id = 'a1000002-0000-4000-8000-000000000002';
UPDATE public.profiles SET avatar_emoji = '🔥', avatar_color = '#FFE66D' WHERE id = 'a1000003-0000-4000-8000-000000000003';
UPDATE public.profiles SET avatar_emoji = '⚡', avatar_color = '#95E1D3' WHERE id = 'a1000004-0000-4000-8000-000000000004';
UPDATE public.profiles SET avatar_emoji = '🎯', avatar_color = '#F38181' WHERE id = 'a1000005-0000-4000-8000-000000000005';
UPDATE public.profiles SET avatar_emoji = '🚀', avatar_color = '#AA96DA' WHERE id = 'a1000006-0000-4000-8000-000000000006';

UPDATE public.profiles
SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at, now())
WHERE onboarding_completed_at IS NULL;

INSERT INTO public.groups (
  id,
  name,
  timezone,
  owner_id,
  billing_status,
  invite_code
)
VALUES (
  'b2000001-0000-4000-8000-000000000001',
  'Sunday Crew',
  'Australia/Sydney',
  'a1000001-0000-4000-8000-000000000001',
  'exempt',
  'sunday01'
);

INSERT INTO public.group_members (
  group_id,
  user_id,
  role,
  status,
  joined_at
)
VALUES
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000001',
    'owner',
    'active',
    now() - interval '60 days'
  ),
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000002-0000-4000-8000-000000000002',
    'member',
    'active',
    now() - interval '45 days'
  ),
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000003-0000-4000-8000-000000000003',
    'member',
    'active',
    now() - interval '30 days'
  ),
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000004-0000-4000-8000-000000000004',
    'admin',
    'active',
    now() - interval '20 days'
  ),
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000006-0000-4000-8000-000000000006',
    'member',
    'active',
    now() - interval '10 days'
  ),
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000005-0000-4000-8000-000000000005',
    'member',
    'pending',
    NULL
  );

-- Push-up entries: current week + prior month (Sydney local dates)
WITH sydney AS (
  SELECT (now() AT TIME ZONE 'Australia/Sydney')::date AS today
)
INSERT INTO public.pushup_entries (
  group_id,
  user_id,
  count,
  logged_for,
  logged_at,
  is_backdated,
  source
)
SELECT
  'b2000001-0000-4000-8000-000000000001',
  v.user_id,
  v.count,
  (s.today + v.day_offset),
  (s.today + v.day_offset)::timestamptz + interval '8 hours',
  v.day_offset <> 0,
  'circle_logger'
FROM sydney s
CROSS JOIN (
  VALUES
    ('a1000001-0000-4000-8000-000000000001'::uuid, 25, 0),
    ('a1000001-0000-4000-8000-000000000001', 15, -1),
    ('a1000002-0000-4000-8000-000000000002', 30, 0),
    ('a1000002-0000-4000-8000-000000000002', 20, -2),
    ('a1000003-0000-4000-8000-000000000003', 40, -1),
    ('a1000003-0000-4000-8000-000000000003', 35, -4),
    ('a1000004-0000-4000-8000-000000000004', 50, 0),
    ('a1000004-0000-4000-8000-000000000004', 22, -3),
    ('a1000006-0000-4000-8000-000000000006', 18, 0),
    ('a1000006-0000-4000-8000-000000000006', 12, -5),
    ('a1000001-0000-4000-8000-000000000001', 45, -14),
    ('a1000002-0000-4000-8000-000000000002', 28, -18),
    ('a1000003-0000-4000-8000-000000000003', 55, -21),
    ('a1000004-0000-4000-8000-000000000004', 33, -25),
    ('a1000006-0000-4000-8000-000000000006', 20, -28)
) AS v(user_id, count, day_offset);

-- Phase 2: demo weekly competition for Sunday Crew
WITH sydney AS (
  SELECT (now() AT TIME ZONE 'Australia/Sydney')::timestamptz AS now_local
),
week_bounds AS (
  SELECT
    date_trunc('week', (s.now_local AT TIME ZONE 'Australia/Sydney')::timestamp)::date AS week_start
  FROM sydney s
)
INSERT INTO public.competitions (
  id,
  group_id,
  name,
  competition_kind,
  challenge_type,
  intensity,
  starts_at,
  ends_at,
  created_by
)
SELECT
  'c3000001-0000-4000-8000-000000000001',
  'b2000001-0000-4000-8000-000000000001',
  'Sunday Crew Weekly',
  'weekly',
  'leaderboard',
  'moderate',
  (wb.week_start::timestamp AT TIME ZONE 'Australia/Sydney'),
  ((wb.week_start + interval '7 days')::timestamp AT TIME ZONE 'Australia/Sydney'),
  'a1000001-0000-4000-8000-000000000001'
FROM week_bounds wb;

INSERT INTO public.competition_participants (
  competition_id,
  user_id,
  official_scoring_starts_at
)
SELECT
  'c3000001-0000-4000-8000-000000000001',
  gm.user_id,
  (now() AT TIME ZONE 'Australia/Sydney')::timestamptz
FROM public.group_members gm
WHERE gm.group_id = 'b2000001-0000-4000-8000-000000000001'
  AND gm.status = 'active';
