export type SorenessStatus = 'good' | 'bit_sore' | 'pain_stop'

export type WizardSorenessLevel = 'none' | 'mild' | 'notable'

export function sorenessSuppressesMaxCheckIn(status: SorenessStatus | null | undefined): boolean {
  return status === 'bit_sore' || status === 'pain_stop'
}

export function sorenessHoldsProgression(status: SorenessStatus | null | undefined): boolean {
  return status === 'bit_sore' || status === 'pain_stop'
}

export function shouldPromptSorenessCheckIn(input: {
  wasChallengeDay: boolean
  lastEffortWasHard: boolean
  alreadyCheckedInToday: boolean
}): boolean {
  if (input.alreadyCheckedInToday) return false
  return input.wasChallengeDay || input.lastEffortWasHard
}
