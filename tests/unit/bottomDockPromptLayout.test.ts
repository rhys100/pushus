import { describe, expect, it } from 'vitest'
import {
  bottomDockPromptPositionClass,
  bottomDockPromptSitsAboveBottomNav,
} from '@/lib/bottomDockPromptLayout'

describe('bottomDockPromptLayout', () => {
  it('offsets prompts above bottom nav on tab routes', () => {
    expect(bottomDockPromptSitsAboveBottomNav('/leaderboard')).toBe(true)
    expect(bottomDockPromptSitsAboveBottomNav('/settings')).toBe(true)
    expect(bottomDockPromptPositionClass('/leaderboard')).toContain('bottom-nav-height')
  })

  it('does not offset on routes without bottom nav', () => {
    expect(bottomDockPromptSitsAboveBottomNav('/group/billing')).toBe(false)
    expect(bottomDockPromptPositionClass('/group/billing')).toContain('bottom-0')
  })
})
