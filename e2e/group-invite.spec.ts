import { test, expect, type Page } from '@playwright/test'
import { createLocalOwnerSession } from './localAuth'

let ownerSession: string | null = null

async function seedAuthSession(page: Page) {
  if (!ownerSession) return

  await page.addInitScript((sessionValue) => {
    window.localStorage.setItem('sb-127-auth-token', sessionValue)
  }, ownerSession)
}

test.describe('group invite screen', () => {
  test.beforeAll(async () => {
    ownerSession = await createLocalOwnerSession()
  })

  test('shows primary invite actions and collapses technical options', async ({ page }) => {
    if (!ownerSession) {
      test.skip()
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await seedAuthSession(page)
    await page.goto('/group', { waitUntil: 'networkidle' })

    await expect(page.getByText('Invite your mates')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/join your group/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy invite message/i })).toBeVisible()

    const details = page.locator('details')
    await expect(details).toBeVisible()
    await expect(page.getByText('More invite options')).toBeVisible()
    await expect(details.getByText('Invite link')).not.toBeVisible()
    await expect(details.getByText('Invite code')).not.toBeVisible()

    await details.locator('summary').click()
    await expect(details.getByText('Invite link')).toBeVisible()
    await expect(details.getByText('Invite code')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Copy link$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Copy code$/i })).toBeVisible()

    const messagePreview = page.locator('p.whitespace-pre-wrap').first()
    await expect(messagePreview).toContainText(/join the group/i)
    await expect(messagePreview).not.toContainText(/you are in/i)
  })
})
