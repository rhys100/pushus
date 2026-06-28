import { test, expect } from 'vitest'
import {
  PAGE_BOTTOM_PADDING,
  PAGE_BOTTOM_PADDING_WITH_NAV,
  TODAY_BOTTOM_CHROME,
  TODAY_CONTENT_PADDING,
} from '@/lib/layout'

test('today layout tokens include nav, gap, bank hint block, bank CTA, and safe area', () => {
  expect(TODAY_BOTTOM_CHROME).toContain('3.25rem')
  expect(TODAY_BOTTOM_CHROME).toContain('var(--bank-hint-block)')
  expect(TODAY_BOTTOM_CHROME).toContain('env(safe-area-inset-bottom)')
  expect(TODAY_CONTENT_PADDING).toContain(TODAY_BOTTOM_CHROME)
})

test('page bottom padding tokens include safe area', () => {
  expect(PAGE_BOTTOM_PADDING).toContain('env(safe-area-inset-bottom)')
  expect(PAGE_BOTTOM_PADDING_WITH_NAV).toContain('env(safe-area-inset-bottom)')
})
