import type { DayPrescription, DayType } from '@/lib/training/planEngine'

export type DailySetPlanInput = Pick<DayPrescription, 'dayType' | 'target' | 'setSize' | 'sets'> & {
  isRestDay?: boolean
}

export type DailySetPlan = {
  dayType: DayType | 'rest'
  dayTypeLabel: string
  banksLogged: number
  setsPlanned: number
  setsRemaining: number
  currentSetNumber: number | null
  nextBankTarget: number
  remainingReps: number
  goalHit: boolean
  headline: string
  detail: string | null
}

const DAY_TYPE_LABEL: Record<DayType, string> = {
  rest: 'Rest',
  easy: 'Easy',
  moderate: 'Moderate',
  challenge: 'Challenge',
}

export function computeDailySetPlan(
  prescription: DailySetPlanInput,
  bankedToday: number,
  banksLogged: number,
): DailySetPlan {
  const isRestDay = prescription.isRestDay ?? prescription.dayType === 'rest'
  const target = prescription.target
  const setSize = prescription.setSize
  const setsPlanned = prescription.sets
  const remainingReps = Math.max(target - bankedToday, 0)
  const goalHit = !isRestDay && target > 0 && bankedToday >= target

  if (isRestDay || target === 0) {
    return {
      dayType: 'rest',
      dayTypeLabel: 'Rest',
      banksLogged,
      setsPlanned: 0,
      setsRemaining: 0,
      currentSetNumber: null,
      nextBankTarget: 0,
      remainingReps: 0,
      goalHit: false,
      headline: 'Recovery day — no target.',
      detail: banksLogged > 0 ? 'Optional light work logged.' : 'Spread hard work across your training days.',
    }
  }

  if (goalHit) {
    return {
      dayType: prescription.dayType,
      dayTypeLabel: DAY_TYPE_LABEL[prescription.dayType],
      banksLogged,
      setsPlanned,
      setsRemaining: 0,
      currentSetNumber: null,
      nextBankTarget: 0,
      remainingReps: 0,
      goalHit: true,
      headline: 'Daily goal hit — nice work.',
      detail:
        banksLogged > 0
          ? `${banksLogged} set${banksLogged === 1 ? '' : 's'} banked today.`
          : null,
    }
  }

  const setsRemaining = Math.max(setsPlanned - banksLogged, 0)
  const nextBankTarget = Math.min(setSize, remainingReps)
  const currentSetNumber =
    setsPlanned > 0 ? Math.min(banksLogged + 1, setsPlanned) : null

  let headline: string
  if (nextBankTarget <= 0) {
    headline = 'Daily goal hit — nice work.'
  } else if (setsRemaining <= 0 && remainingReps > 0) {
    headline = `Bank about ${nextBankTarget} to finish today`
  } else if (setsRemaining === 1) {
    headline = `Bank about ${nextBankTarget} — last set`
  } else if (currentSetNumber !== null && setsPlanned > 0) {
    headline = `Bank about ${nextBankTarget} — set ${currentSetNumber} of ${setsPlanned}`
  } else {
    headline = `Bank about ${nextBankTarget} this set`
  }

  const detailParts: string[] = []
  if (setsRemaining > 0) {
    detailParts.push(
      `${setsRemaining} set${setsRemaining === 1 ? '' : 's'} left · ${remainingReps} reps to goal`,
    )
  } else if (remainingReps > 0) {
    detailParts.push(`${remainingReps} reps left to goal`)
  }
  detailParts.push('Spread sets through the day — rest 30+ min between banks')

  return {
    dayType: prescription.dayType,
    dayTypeLabel: DAY_TYPE_LABEL[prescription.dayType],
    banksLogged,
    setsPlanned,
    setsRemaining,
    currentSetNumber,
    nextBankTarget,
    remainingReps,
    goalHit: false,
    headline,
    detail: detailParts.join(' · '),
  }
}
