const DEGREES_PER_REVOLUTION = 360
const REPS_PER_REVOLUTION = 10
const DEGREES_PER_REP = DEGREES_PER_REVOLUTION / REPS_PER_REVOLUTION

function clampWithinLapRep(rep: number): number {
  return Math.min(REPS_PER_REVOLUTION, Math.max(0, rep))
}

function withinLapRepFromAngle(angleDegrees: number): number {
  const normalized =
    ((angleDegrees % DEGREES_PER_REVOLUTION) + DEGREES_PER_REVOLUTION) %
    DEGREES_PER_REVOLUTION

  if (normalized === 0) {
    return 0
  }

  return clampWithinLapRep(Math.round(normalized / DEGREES_PER_REP))
}

/** Rep count within a single 0–360° revolution (0–10). */
export function countWithinRevolution(angleDegrees: number): number {
  const normalized =
    ((angleDegrees % DEGREES_PER_REVOLUTION) + DEGREES_PER_REVOLUTION) %
    DEGREES_PER_REVOLUTION

  if (normalized === 0) {
    return 0
  }

  return withinLapRepFromAngle(normalized)
}

/**
 * Map cumulative drag angle to total rep count.
 * Rep N sits at N × 36° clockwise from top; rep 10 / full lap = 360°.
 */
export function angleToTotalCount(totalAngleDegrees: number): number {
  if (totalAngleDegrees <= 0) {
    return 0
  }

  const revolutions = Math.floor(totalAngleDegrees / DEGREES_PER_REVOLUTION)
  const remainder = totalAngleDegrees % DEGREES_PER_REVOLUTION

  if (remainder === 0) {
    return revolutions * REPS_PER_REVOLUTION
  }

  return revolutions * REPS_PER_REVOLUTION + withinLapRepFromAngle(remainder)
}

/** Map rep count to dial angle (handle + arc). Rep 5 = bottom, rep 10 = top. */
export function countToAngle(count: number): number {
  if (count <= 0) {
    return 0
  }

  const withinLap = count % REPS_PER_REVOLUTION

  if (withinLap === 0) {
    return (count / REPS_PER_REVOLUTION) * DEGREES_PER_REVOLUTION
  }

  const revolutions = Math.floor((count - 1) / REPS_PER_REVOLUTION)

  return revolutions * DEGREES_PER_REVOLUTION + withinLap * DEGREES_PER_REP
}

/** Map cumulative drag angle to the nearest rep position on the dial. */
export function snapAngleToRep(totalAngleDegrees: number): number {
  return countToAngle(angleToTotalCount(totalAngleDegrees))
}

/** @deprecated Incremental drag no longer jumps on pointer down; kept for reference. */
export function rawAngleFromPointerDown(ringAngle: number): number {
  return Math.max(0, snapAngleToRep(ringAngle))
}

/** @deprecated Incremental drag no longer jumps on pointer down; kept for reference. */
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
