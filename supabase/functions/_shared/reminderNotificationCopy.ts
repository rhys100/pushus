/**
 * Deno-compatible push reminder copy — mirrors src/lib/notifications/reminderNotificationCopy.ts
 */

type DayType = 'rest' | 'easy' | 'moderate' | 'challenge'

type DailySetPlanInput = {
  dayType: DayType
  target: number
  setSize: number
  sets: number
  isRestDay?: boolean
}

type DailySetPlan = {
  nextBankTarget: number
  goalHit: boolean
  headline: string
}

function computeDailySetPlan(
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
    return { nextBankTarget: 0, goalHit: false, headline: 'Recovery day — no target.' }
  }

  if (goalHit) {
    return { nextBankTarget: 0, goalHit: true, headline: 'Daily goal hit — nice work.' }
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

  return { nextBankTarget, goalHit: false, headline }
}

export const REMINDER_NOTIFICATION_URL = '/today'
export const REMINDER_NOTIFICATION_TITLE = 'PushUS'

export type ReminderNotificationCopyInput = {
  prescription: DailySetPlanInput | null
  bankedToday: number
  banksLogged: number
  remainingTotal: number
}

export function buildReminderNotificationCopy(
  input: ReminderNotificationCopyInput,
): { title: string; body: string; url: string } {
  const base = {
    title: REMINDER_NOTIFICATION_TITLE,
    url: REMINDER_NOTIFICATION_URL,
  }

  const { prescription, bankedToday, banksLogged, remainingTotal } = input
  const repLabel = `${remainingTotal} push-up${remainingTotal === 1 ? '' : 's'}`

  if (
    !prescription ||
    prescription.target === 0 ||
    prescription.isRestDay ||
    prescription.dayType === 'rest'
  ) {
    return {
      ...base,
      body: `${repLabel} left today — tap to log`,
    }
  }

  const plan = computeDailySetPlan(prescription, bankedToday, banksLogged)

  if (plan.goalHit || plan.nextBankTarget <= 0) {
    return {
      ...base,
      body: 'Daily goal hit — tap to review',
    }
  }

  return {
    ...base,
    body: `${plan.headline} — tap to log`,
  }
}
