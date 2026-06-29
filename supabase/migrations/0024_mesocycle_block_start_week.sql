-- Track mesocycle week at block start (e.g. week 2 after high-volume calibration)

ALTER TABLE public.user_training_plans
  ADD COLUMN IF NOT EXISTS mesocycle_block_start_week smallint NOT NULL DEFAULT 1
    CHECK (mesocycle_block_start_week >= 1 AND mesocycle_block_start_week <= 4);

COMMENT ON COLUMN public.user_training_plans.mesocycle_block_start_week IS
  'Mesocycle week when the current 4-week block began (1 normal, 2 when skipping deload week).';

-- Best-effort backfill for plans that may have been calibrated to week 2
UPDATE public.user_training_plans
SET mesocycle_block_start_week = mesocycle_week
WHERE mesocycle_week > 1
  AND calibration_note IS NOT NULL
  AND calibration_note ILIKE '%85%';
