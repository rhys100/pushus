const DEGREES_PER_REVOLUTION = 360
const REPS_PER_REVOLUTION = 10
const DEGREES_PER_REP = DEGREES_PER_REVOLUTION / REPS_PER_REVOLUTION

/** Rep count within a single 0–360° revolution (1–10). */
export function countWithinRevolution(angleDegrees: number): number {
  const normalized = ((angleDegrees % DEGREES_PER_REVOLUTION) + DEGREES_PER_REVOLUTION) % DEGREES_PER_REVOLUTION

  if (normalized === 0) {
    return 1
  }

  return Math.floor(normalized / DEGREES_PER_REP) + 1
}

/**
 * Map cumulative drag angle to total rep count.
 * Each full 360° adds 10 reps; partial revolutions use floor(angle/36)+1.
 */
export function angleToTotalCount(totalAngleDegrees: number): number {
  if (totalAngleDegrees <= 0) {
    return 0
  }

  const revolutions = Math.floor(totalAngleDegrees / DEGREES_PER_REVOLUTION)
  const remainder = totalAngleDegrees % DEGREES_PER_REVOLUTION

  const withinRev =
    remainder === 0 ? 0 : Math.floor(remainder / DEGREES_PER_REP) + 1

  return revolutions * REPS_PER_REVOLUTION + withinRev
}

/** Map a target rep count to a representative drag angle (centre of each rep slot). */
export function countToAngle(count: number): number {
  if (count <= 0) {
    return 0
  }

  const revolutions = Math.floor((count - 1) / REPS_PER_REVOLUTION)
  const withinRev = ((count - 1) % REPS_PER_REVOLUTION) + 1

  if (withinRev === REPS_PER_REVOLUTION) {
    return (revolutions + 1) * DEGREES_PER_REVOLUTION
  }

  return revolutions * DEGREES_PER_REVOLUTION + withinRev * DEGREES_PER_REP - DEGREES_PER_REP / 2
}

/** Map cumulative drag angle to the centre of the current rep slot (stepped feel). */
export function snapAngleToRep(totalAngleDegrees: number): number {
  return countToAngle(angleToTotalCount(totalAngleDegrees))
}

/** Snap a pointer ring angle (0–360°) to the first-lap rep slot centre. */
export function rawAngleFromPointerDown(ringAngle: number): number {
  return Math.max(0, snapAngleToRep(ringAngle))
}

/** Jump to a rep slot on the current lap, preserving completed full revolutions. */
export function ringAngleToRawAngle(ringAngle: number, currentRaw: number): number {
  if (currentRaw <= 0) {
    return rawAngleFromPointerDown(ringAngle)
  }

  const revBase =
    Math.floor(currentRaw / DEGREES_PER_REVOLUTION) * DEGREES_PER_REVOLUTION
  const normalized =
    ((ringAngle % DEGREES_PER_REVOLUTION) + DEGREES_PER_REVOLUTION) %
    DEGREES_PER_REVOLUTION
  const snapped =
    normalized === 0 ? countToAngle(1) : snapAngleToRep(normalized) || countToAngle(1)

  return Math.max(revBase + snapped, countToAngle(1))
}

export function normalizeAngleDelta(delta: number): number {
  if (delta > 180) {
    return delta - 360
  }

  if (delta < -180) {
    return delta + 360
  }

  return delta
}

export const CIRCULAR_COUNTER = {
  degreesPerRevolution: DEGREES_PER_REVOLUTION,
  repsPerRevolution: REPS_PER_REVOLUTION,
  degreesPerRep: DEGREES_PER_REP,
} as const
