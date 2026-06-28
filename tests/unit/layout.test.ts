import { test, expect } from 'vitest'
import {
  PAGE_BOTTOM_PADDING,
  PAGE_BOTTOM_PADDING_WITH_NAV,
} from '@/lib/layout'

test('page bottom padding tokens include safe area and nav height', () => {
  expect(PAGE_BOTTOM_PADDING).toContain('safe-area-inset-bottom')
  expect(PAGE_BOTTOM_PADDING_WITH_NAV).toContain('var(--bottom-nav-height)')
})
