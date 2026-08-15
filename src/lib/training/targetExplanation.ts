import type { MesocycleWeek, TodayPrescription, TrainingPlan } from '@/lib/training/planEngine'

/**
 * Explains the daily target the engine already computed, in plain language.
 *
 * The hard rule here is that every factor must correspond to something that
 * genuinely moved today's number. The engine has several fields that look like
 * causes and are not, and quoting them would make the app confidently wrong:
 *
 *  - `progression_note` describes a change to `planBaseline`, which does not
 *    feed the target at all once a member has enough history to be scored on
 *    their real volume. Never cited.
 *  - today's soreness check-in only decides whether a max check-in is
 *    suggested; it does not lower the target. The wizard's stored soreness
 *    answer is the thing that does.
 *  - the mesocycle percentages only apply on one of the two scoring paths, so
 *    the week is described qualitatively ("deload week") and never as a number.
 *  - `dailyTarget` is not `todayPrescription.target` when a member is ramping
 *    back from injury, so the easing is surfaced as its own factor.
 */

export type TargetFactor = {
  id: string
  title: string
  detail: string
}

export type TargetExplanation = {
  headline: string
  factors: TargetFactor[]
  /** Shown last, quieter — this is guidance, not a medical prescription. */
  footnote: string | null
}

export type TargetExplanationInput = {
  plan: TrainingPlan
  prescription: TodayPrescription
  /** Post-ramp-back target actually shown on the card. */
  dailyTarget: number | null
  isRampBack: boolean
  /** Persisted wizard answer — NOT today's check-in. */
  wizardSorenessLevel: string | null | undefined
}

const WEEK_CHARACTER: Record<MesocycleWeek, string> = {
  1: 'the first week of a new block, so volume starts lower and builds',
  2: 'the second week of the block, building on last week',
  3: 'the heaviest week of the block',
  4: 'a deload week — deliberately lighter so you recover and come back stronger',
}

export function buildTargetExplanation({
  plan,
  prescription,
  dailyTarget,
  isRampBack,
  wizardSorenessLevel,
}: TargetExplanationInput): TargetExplanation {
  const factors: TargetFactor[] = []
  const target = dailyTarget ?? prescription.target

  if (prescription.isRestDay) {
    return {
      headline: 'Today is a rest day.',
      factors: [
        {
          id: 'rest',
          title: 'Rest is part of the plan',
          detail:
            'You picked how many days a week you train, and this is one of the days off. Muscle is built while you recover, not while you train.',
        },
        {
          id: 'schedule',
          title: `You train ${plan.trainingDaysPerWeek} days a week`,
          detail: 'Change that any time in Settings → Training plan.',
        },
      ],
      footnote: 'Logging on a rest day is fine — it just is not required.',
    }
  }

  factors.push({
    id: 'max',
    title: `Your clean max is ${plan.planMaxClean}`,
    detail:
      'Everything scales from the most push-ups you can do in one clean set. Update it in Settings whenever it changes and the whole plan moves with it.',
  })

  factors.push({
    id: 'day-type',
    title: `Today is a ${prescription.dayTypeLabel.toLowerCase()} day`,
    detail:
      prescription.dayType === 'challenge'
        ? 'Your hardest day of the week — this is where the progress comes from.'
        : prescription.dayType === 'easy'
          ? 'A lighter day that keeps volume up without digging a recovery hole.'
          : 'A middle day: real work, but you should finish feeling like you had more in you.',
  })

  factors.push({
    id: 'block-week',
    title: `Week ${prescription.mesocycleWeek} of 4`,
    detail: `This is ${WEEK_CHARACTER[prescription.mesocycleWeek]}.`,
  })

  if (prescription.sets > 0 && prescription.setSize > 0) {
    factors.push({
      id: 'sets',
      title: `Split into about ${prescription.sets} × ${prescription.setSize}`,
      detail:
        'Several submaximal sets beat one all-out set for total volume and leave your form intact. Spread them through the day.',
    })
  }

  if (isRampBack) {
    factors.push({
      id: 'ramp-back',
      title: 'Eased while you ramp back',
      detail:
        'You are coming back from a break, so targets are held around 30% below your normal plan until you resume it.',
    })
  }

  if (wizardSorenessLevel === 'mild' || wizardSorenessLevel === 'notable') {
    factors.push({
      id: 'soreness',
      title: 'Adjusted for how sore you said you get',
      detail:
        'You told the setup wizard you get sore after training, so your targets are held lower than the default. You can change that answer in Settings → Training plan.',
    })
  }

  if (prescription.safetyNote) {
    factors.push({
      id: 'cap',
      title: 'Capped for safety',
      detail: prescription.safetyNote,
    })
  }

  return {
    headline:
      target > 0
        ? `Today's target is ${target} push-ups.`
        : 'No target set for today.',
    factors,
    footnote: 'General fitness guidance, not medical advice.',
  }
}
