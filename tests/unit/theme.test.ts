import { describe, expect, it } from 'vitest'
import { isThemePreference, resolveTheme } from '../../src/lib/theme'

describe('theme', () => {
  describe('resolveTheme', () => {
    it('follows the system in system mode', () => {
      expect(resolveTheme('system', true)).toBe('dark')
      expect(resolveTheme('system', false)).toBe('light')
    })

    it('ignores the system for explicit choices', () => {
      expect(resolveTheme('dark', false)).toBe('dark')
      expect(resolveTheme('light', true)).toBe('light')
    })
  })

  describe('isThemePreference', () => {
    it('accepts the three valid preferences', () => {
      expect(isThemePreference('light')).toBe(true)
      expect(isThemePreference('dark')).toBe(true)
      expect(isThemePreference('system')).toBe(true)
    })

    it('rejects anything else', () => {
      expect(isThemePreference(null)).toBe(false)
      expect(isThemePreference('auto')).toBe(false)
      expect(isThemePreference(1)).toBe(false)
    })
  })
})
