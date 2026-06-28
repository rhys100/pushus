export const LOGGER_RING_SIZE = 280

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
