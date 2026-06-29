export type EffortRating = 'easy' | 'good' | 'hard'

export const EFFORT_RIR: Record<EffortRating, number> = {
  easy: 5,
  good: 3,
  hard: 1,
}

export function effortRatingToRir(rating: EffortRating): number {
  return EFFORT_RIR[rating]
}

export function shouldAskEffortFeedback(input: {
  wizardCompleted: boolean
  isRestDay: boolean
  banksLogged: number
  setsPlanned: number
  effortAskedToday: boolean
  dayType: string
}): boolean {
  if (!input.wizardCompleted || input.isRestDay) return false
  if (input.effortAskedToday) return false
  if (input.setsPlanned <= 0) return false
  return input.banksLogged >= input.setsPlanned
}
