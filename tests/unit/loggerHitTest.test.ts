import { describe, expect, it } from 'vitest'
import {
  clientToRingCoords,
  isNearHandle,
  isPointOnRingTrack,
  pointerToRingAngle,
} from '../../src/lib/loggerHitTest'

const RING_RECT = {
  left: 100,
  top: 200,
  width: 280,
  height: 280,
  right: 380,
  bottom: 480,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect

const RING_RADIUS = 112
const RING_STROKE = 14

describe('loggerHitTest', () => {
  describe('clientToRingCoords', () => {
    it('maps the ring centre to viewBox centre', () => {
      expect(clientToRingCoords(240, 340, RING_RECT)).toEqual({ x: 140, y: 140 })
    })
  })

  describe('pointerToRingAngle', () => {
    it('maps clock positions to ring degrees (0° = 12 o’clock)', () => {
      expect(pointerToRingAngle(240, 200, RING_RECT)).toBeCloseTo(0, 0)
      expect(pointerToRingAngle(380, 340, RING_RECT)).toBeCloseTo(90, 0)
      expect(pointerToRingAngle(240, 480, RING_RECT)).toBeCloseTo(180, 0)
      expect(pointerToRingAngle(100, 340, RING_RECT)).toBeCloseTo(270, 0)
    })
  })

  describe('isNearHandle', () => {
    const handleAtTop = { x: 140, y: 28 }

    it('accepts touches on the handle hit target', () => {
      expect(isNearHandle(240, 228, RING_RECT, handleAtTop, 22)).toBe(true)
    })

    it('rejects touches in the ring centre', () => {
      expect(isNearHandle(240, 340, RING_RECT, handleAtTop, 22)).toBe(false)
    })

    it('rejects touches outside the ring square', () => {
      expect(isNearHandle(240, 520, RING_RECT, handleAtTop, 22)).toBe(false)
    })
  })

  describe('isPointOnRingTrack', () => {
    it('accepts touches on the ring stroke', () => {
      expect(isPointOnRingTrack(240, 228, RING_RECT, RING_RADIUS, RING_STROKE)).toBe(true)
      expect(isPointOnRingTrack(240, 452, RING_RECT, RING_RADIUS, RING_STROKE)).toBe(true)
    })

    it('rejects touches in the centre dead zone', () => {
      expect(isPointOnRingTrack(240, 340, RING_RECT, RING_RADIUS, RING_STROKE)).toBe(false)
    })

    it('rejects touches far outside the ring', () => {
      expect(isPointOnRingTrack(240, 520, RING_RECT, RING_RADIUS, RING_STROKE)).toBe(false)
    })
  })
})
