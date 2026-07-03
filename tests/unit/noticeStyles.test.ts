import { describe, expect, it } from 'vitest'
import {
  noticeBannerClass,
  noticeInlineClass,
  noticeSurfaceClass,
} from '@/lib/noticeStyles'

describe('noticeStyles', () => {
  it('uses opaque surface backgrounds for every tone', () => {
    for (const tone of Object.keys(noticeSurfaceClass) as Array<
      keyof typeof noticeSurfaceClass
    >) {
      expect(noticeSurfaceClass[tone]).toContain('bg-surface')
      expect(noticeSurfaceClass[tone]).not.toMatch(/bg-\w+\/(10|15|20|30)/)
    }
  })

  it('builds banner and inline helpers from shared surfaces', () => {
    expect(noticeBannerClass('success')).toContain(noticeSurfaceClass.success)
    expect(noticeInlineClass('warning')).toContain(noticeSurfaceClass.warning)
  })
})
