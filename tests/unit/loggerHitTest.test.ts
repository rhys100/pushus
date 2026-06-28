import { describe, expect, it } from 'vitest'
import { clientToRingCoords, isNearHandle } from '../../src/lib/loggerHitTest'

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

describe('loggerHitTest', () => {
  describe('clientToRingCoords', () => {
    it('maps the ring centre to viewBox centre', () => {
      expect(clientToRingCoords(240, 340, RING_RECT)).toEqual({ x: 140, y: 140 })
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
})
