import {
  computeDailySetPlan,
  type DailySetPlanInput,
} from '@/lib/training/dailySetPlan'

export const REMINDER_NOTIFICATION_URL = '/today'
export const REMINDER_NOTIFICATION_TITLE = 'PushUS'

export type ReminderNotificationCopyInput = {
  prescription: DailySetPlanInput | null
  bankedToday: number
  banksLogged: number
  remainingTotal: number
}

export type ReminderNotificationCopy = {
  title: string
  body: string
  url: string
}

/** Push reminder title/body/url — mirrored in supabase/functions/_shared/reminderNotificationCopy.ts */
export function buildReminderNotificationCopy(
  input: ReminderNotificationCopyInput,
): ReminderNotificationCopy {
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
