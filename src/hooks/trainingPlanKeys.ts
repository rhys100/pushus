export const trainingPlanQueryKey = (userId: string | undefined, groupId: string | undefined) =>
  ['training-plan', userId, groupId] as const

export const maxCheckInContextQueryKey = (
  userId: string | undefined,
  groupId: string | undefined,
  todayIso: string,
) => ['max-checkin-context', userId, groupId, todayIso] as const
