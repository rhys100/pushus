import { test, expect, type Page } from '@playwright/test'
import { createLocalMemberSession } from './localAuth'

let memberSession: string | null = null

async function seedAuthSession(page: Page) {
  if (!memberSession) return

  await page.addInitScript((sessionValue) => {
    window.localStorage.setItem('sb-127-auth-token', sessionValue)
  }, memberSession)
}

test.describe.configure({ mode: 'serial' })

test.describe('activity feed history', () => {
  test.beforeAll(async () => {
    memberSession = await createLocalMemberSession()
  })

  test.beforeEach(async ({ page }) => {
    if (!memberSession) {
      test.skip()
    }
    await seedAuthSession(page)
  })

  test('my log segment shows calendar and entries section', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/activity', { waitUntil: 'networkidle' })

    await page.getByRole('tab', { name: 'My log' }).click()

    await expect(page.getByLabel('Rep calendar')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Today's entries/i })).toBeVisible()
  })
})
