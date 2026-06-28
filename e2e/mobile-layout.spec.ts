import { test, expect, type Page } from '@playwright/test'
import { createLocalMemberSession, createLocalOwnerSession } from './localAuth'

let memberSession: string | null = null
let ownerSession: string | null = null

async function seedSession(page: Page, sessionValue: string) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('sb-127-auth-token', value)
  }, sessionValue)
}

test.describe.configure({ mode: 'serial' })

test.describe('mobile layout smoke', () => {
  test.beforeAll(async () => {
    memberSession = await createLocalMemberSession()
    ownerSession = await createLocalOwnerSession()
  })

  test('settings scrolls with static header and bottom padding', async ({ page }) => {
    if (!memberSession) test.skip()

    await page.setViewportSize({ width: 390, height: 844 })
    await seedSession(page, memberSession!)
    await page.goto('/settings', { waitUntil: 'networkidle' })

    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Training plan')).toHaveCount(0)
    await expect(page.getByText('About PushUS')).toBeVisible()

    const signOut = page.getByRole('button', { name: /Sign out/i })
    await signOut.scrollIntoViewIfNeeded()
    await expect(signOut).toBeVisible()

    const signOutBox = await signOut.boundingBox()
    const viewportHeight = page.viewportSize()?.height ?? 844
    expect(signOutBox).not.toBeNull()
    if (signOutBox) {
      expect(signOutBox.y + signOutBox.height).toBeLessThanOrEqual(viewportHeight + 1)
    }
  })

  test('about page source link is fully visible above bottom safe area', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/about', { waitUntil: 'networkidle' })

    const sourceLink = page.getByRole('link', { name: /github\.com/i })
    await expect(sourceLink).toBeVisible({ timeout: 10_000 })
    await sourceLink.scrollIntoViewIfNeeded()

    const linkBox = await sourceLink.boundingBox()
    const viewportHeight = page.viewportSize()?.height ?? 844
    expect(linkBox).not.toBeNull()
    if (linkBox) {
      expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(viewportHeight)
    }
  })

  test('group invite section is not clipped under header', async ({ page }) => {
    if (!ownerSession) test.skip()

    await page.setViewportSize({ width: 390, height: 844 })
    await seedSession(page, ownerSession!)
    await page.goto('/group', { waitUntil: 'networkidle' })

    const header = page.getByRole('heading', { level: 1 }).first()
    const inviteHeading = page.getByText('Invite your mates')
    await expect(inviteHeading).toBeVisible({ timeout: 20_000 })

    const headerBox = await header.boundingBox()
    const inviteBox = await inviteHeading.boundingBox()
    expect(headerBox).not.toBeNull()
    expect(inviteBox).not.toBeNull()
    if (headerBox && inviteBox) {
      expect(inviteBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 2)
    }
  })
})
