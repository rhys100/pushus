-- Training plan v2 — weekly schedule, mesocycle fields, enum alignment

-- Align Postgres enums with app wizard values
ALTER TYPE public.training_level ADD VALUE IF NOT EXISTS 'intermediate';
ALTER TYPE public.training_level ADD VALUE IF NOT EXISTS 'advanced';

ALTER TYPE public.challenge_intensity ADD VALUE IF NOT EXISTS 'light';
ALTER TYPE public.challenge_intensity ADD VALUE IF NOT EXISTS 'intense';

ALTER TABLE public.user_training_plans
  ADD COLUMN IF NOT EXISTS weekly_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mesocycle_week smallint NOT NULL DEFAULT 1
    CHECK (mesocycle_week >= 1 AND mesocycle_week <= 4),
  ADD COLUMN IF NOT EXISTS mesocycle_started_at date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS plan_baseline numeric(4, 2) NOT NULL DEFAULT 1.00
    CHECK (plan_baseline >= 0.5 AND plan_baseline <= 2.00),
  ADD COLUMN IF NOT EXISTS challenge_days integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_progression_at timestamptz,
  ADD COLUMN IF NOT EXISTS progression_note text;

COMMENT ON COLUMN public.user_training_plans.weekly_schedule IS
  '7-day prescription keyed by day-of-week (0=Sun..6=Sat): dayType, target, setSize, sets, label';
COMMENT ON COLUMN public.user_training_plans.estimated_capacity IS
  'Peak-day target reps (highest training day in weekly_schedule)';
COMMENT ON COLUMN public.user_training_plans.mesocycle_week IS
  'Current week within 4-week build block (1=ramp, 2=build, 3=peak, 4=deload)';

-- Existing rows: app recomputes schedule on fetch when weekly_schedule is empty.
-- Reset mesocycle start for active plans so the new block begins cleanly.
UPDATE public.user_training_plans
SET
  mesocycle_started_at = CURRENT_DATE,
  mesocycle_week = 1,
  plan_baseline = 1.00
WHERE wizard_completed = true
  AND (weekly_schedule = '{}'::jsonb OR weekly_schedule IS NULL);
