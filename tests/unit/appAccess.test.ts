import { describe, expect, it } from 'vitest'
import {
  defaultAppAccess,
  deniedAppAccess,
  parseAppAccess,
} from '../../src/lib/appAccess'

describe('appAccess', () => {
  it('parses an allowed access payload', () => {
    expect(
      parseAppAccess({
        allowed: true,
        private_beta_enabled: true,
        can_create_group: false,
        has_group_access: true,
        is_allowlisted: false,
      }),
    ).toEqual({
      allowed: true,
      private_beta_enabled: true,
      can_create_group: false,
      has_group_access: true,
      is_allowlisted: false,
    })
  })

  it('returns denied access for null or malformed payloads', () => {
    expect(parseAppAccess(null)).toEqual(deniedAppAccess)
    expect(parseAppAccess(undefined)).toEqual(deniedAppAccess)
    expect(parseAppAccess('blocked')).toEqual(deniedAppAccess)
  })

  it('keeps default access permissive for transient hydration fallbacks', () => {
    expect(defaultAppAccess.allowed).toBe(true)
    expect(deniedAppAccess.allowed).toBe(false)
  })
})
