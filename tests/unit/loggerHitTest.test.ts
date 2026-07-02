import { describe, expect, it } from 'vitest'
import {
  canStartRingDrag,
  clientToRingCoords,
  isNearHandle,
  isPointOnRingTrack,
  LOGGER_HANDLE_GRAB_RADIUS,
  LOGGER_RING_SIZE,
  pointerToRingAngle,
} from '../../src/lib/loggerHitTest'

const RING_RECT = {
  left: 100,
  top: 200,
  width: LOGGER_RING_SIZE,
  height: LOGGER_RING_SIZE,
  right: 100 + LOGGER_RING_SIZE,
  bottom: 200 + LOGGER_RING_SIZE,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect

const RING_CENTER = LOGGER_RING_SIZE / 2
const RING_RADIUS = 134
const RING_HIT_STROKE = 34

describe('loggerHitTest', () => {
  describe('clientToRingCoords', () => {
    it('maps the ring centre to viewBox centre', () => {
      expect(
        clientToRingCoords(
          RING_RECT.left + RING_RECT.width / 2,
          RING_RECT.top + RING_RECT.height / 2,
          RING_RECT,
        ),
      ).toEqual({ x: RING_CENTER, y: RING_CENTER })
    })
  })

  describe('pointerToRingAngle', () => {
    it('maps clock positions to ring degrees (0° = 12 o’clock)', () => {
      const cx = RING_RECT.left + RING_RECT.width / 2
      const cy = RING_RECT.top + RING_RECT.height / 2

      expect(pointerToRingAngle(cx, RING_RECT.top, RING_RECT)).toBeCloseTo(0, 0)
      expect(pointerToRingAngle(RING_RECT.right, cy, RING_RECT)).toBeCloseTo(90, 0)
      expect(pointerToRingAngle(cx, RING_RECT.bottom, RING_RECT)).toBeCloseTo(180, 0)
      expect(pointerToRingAngle(RING_RECT.left, cy, RING_RECT)).toBeCloseTo(270, 0)
    })
  })

  describe('isNearHandle', () => {
    const handleAtTop = { x: RING_CENTER, y: RING_CENTER - RING_RADIUS }

    it('accepts touches on the handle hit target', () => {
      expect(
        isNearHandle(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER - RING_RADIUS,
          RING_RECT,
          handleAtTop,
          LOGGER_HANDLE_GRAB_RADIUS,
        ),
      ).toBe(true)
    })

    it('accepts touches near but not exactly on the handle dot', () => {
      expect(
        isNearHandle(
          RING_RECT.left + RING_CENTER + 20,
          RING_RECT.top + RING_CENTER - RING_RADIUS + 15,
          RING_RECT,
          handleAtTop,
          LOGGER_HANDLE_GRAB_RADIUS,
        ),
      ).toBe(true)
    })

    it('rejects touches in the ring centre', () => {
      expect(
        isNearHandle(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER,
          RING_RECT,
          handleAtTop,
          LOGGER_HANDLE_GRAB_RADIUS,
        ),
      ).toBe(false)
    })

    it('rejects touches outside the ring square', () => {
      expect(
        isNearHandle(
          RING_RECT.left + RING_CENTER,
          RING_RECT.bottom + 40,
          RING_RECT,
          handleAtTop,
          LOGGER_HANDLE_GRAB_RADIUS,
        ),
      ).toBe(false)
    })
  })

  describe('isPointOnRingTrack', () => {
    it('accepts touches on the ring stroke', () => {
      expect(
        isPointOnRingTrack(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER - RING_RADIUS,
          RING_RECT,
          RING_RADIUS,
          RING_HIT_STROKE,
        ),
      ).toBe(true)
      expect(
        isPointOnRingTrack(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER + RING_RADIUS,
          RING_RECT,
          RING_RADIUS,
          RING_HIT_STROKE,
        ),
      ).toBe(true)
    })

    it('rejects touches in the centre dead zone', () => {
      expect(
        isPointOnRingTrack(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER,
          RING_RECT,
          RING_RADIUS,
          RING_HIT_STROKE,
        ),
      ).toBe(false)
    })

    it('rejects touches far outside the ring', () => {
      expect(
        isPointOnRingTrack(
          RING_RECT.left + RING_CENTER,
          RING_RECT.bottom + 40,
          RING_RECT,
          RING_RADIUS,
          RING_HIT_STROKE,
        ),
      ).toBe(false)
    })
  })

  describe('canStartRingDrag', () => {
    const handleAtTop = { x: RING_CENTER, y: RING_CENTER - RING_RADIUS }

    const dragOptions = {
      ringRadius: RING_RADIUS,
      ringHitStroke: RING_HIT_STROKE,
      handlePoint: handleAtTop,
    }

    it('starts drag near the handle grab zone', () => {
      expect(
        canStartRingDrag(
          RING_RECT.left + RING_CENTER + 24,
          RING_RECT.top + RING_CENTER - RING_RADIUS + 18,
          RING_RECT,
          dragOptions,
        ),
      ).toBe(true)
    })

    it('starts drag on the ring track', () => {
      expect(
        canStartRingDrag(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER + RING_RADIUS,
          RING_RECT,
          dragOptions,
        ),
      ).toBe(true)
    })

    it('does not start drag in the centre', () => {
      expect(
        canStartRingDrag(
          RING_RECT.left + RING_CENTER,
          RING_RECT.top + RING_CENTER,
          RING_RECT,
          dragOptions,
        ),
      ).toBe(false)
    })
  })
})
