export const LOGGER_RING_SIZE = 336
/** Thumb-sized grab target around the handle (SVG viewBox units). */
export const LOGGER_HANDLE_GRAB_RADIUS = 32

export type Point = {
  x: number
  y: number
}

/** Map screen coordinates to SVG viewBox space for the ring. */
export function clientToRingCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  ringSize = LOGGER_RING_SIZE,
): Point {
  const scale = rect.width / ringSize

  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  }
}

/**
 * Pointer angle in ring space: 0° = 12 o'clock, clockwise (matches logger polar coords).
 */
export function pointerToRingAngle(clientX: number, clientY: number, rect: DOMRect): number {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const radians = Math.atan2(clientY - centerY, clientX - centerX)
  const degrees = (radians * 180) / Math.PI

  return (degrees + 90 + 360) % 360
}

/** True when a screen point is within the handle hit radius (SVG units). */
export function isNearHandle(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  handlePoint: Point,
  hitRadius: number,
  ringSize = LOGGER_RING_SIZE,
): boolean {
  const point = clientToRingCoords(clientX, clientY, rect, ringSize)
  const dx = point.x - handlePoint.x
  const dy = point.y - handlePoint.y

  return dx * dx + dy * dy <= hitRadius * hitRadius
}

/** True when a point hits the ring track (not the centre dead zone). */
export function isPointOnRingTrack(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  ringRadius: number,
  strokeWidth: number,
  ringSize = LOGGER_RING_SIZE,
  innerDeadZoneRatio = 0.4,
  hitPadding = 4,
): boolean {
  const point = clientToRingCoords(clientX, clientY, rect, ringSize)
  const center = ringSize / 2
  const dx = point.x - center
  const dy = point.y - center
  const distance = Math.sqrt(dx * dx + dy * dy)

  const innerDead = ringRadius * innerDeadZoneRatio
  const trackInner = ringRadius - strokeWidth / 2 - hitPadding
  const trackOuter = ringRadius + strokeWidth / 2 + hitPadding

  if (distance < innerDead) {
    return false
  }

  return distance >= trackInner && distance <= trackOuter
}

export type RingDragHitOptions = {
  ringRadius: number
  ringHitStroke: number
  handlePoint: Point
  handleGrabRadius?: number
  ringSize?: number
  trackHitPadding?: number
}

/** True when a drag can start on the ring track or near the handle grab zone. */
export function canStartRingDrag(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  options: RingDragHitOptions,
): boolean {
  const ringSize = options.ringSize ?? LOGGER_RING_SIZE
  const handleGrabRadius = options.handleGrabRadius ?? LOGGER_HANDLE_GRAB_RADIUS
  const trackHitPadding = options.trackHitPadding ?? 10

  if (
    isNearHandle(
      clientX,
      clientY,
      rect,
      options.handlePoint,
      handleGrabRadius,
      ringSize,
    )
  ) {
    return true
  }

  return isPointOnRingTrack(
    clientX,
    clientY,
    rect,
    options.ringRadius,
    options.ringHitStroke,
    ringSize,
    0.4,
    trackHitPadding,
  )
}
