import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /PushUS/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Send magic link/i })).toBeVisible()
    await expect(page.getByLabel(/Got an invite code/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /About PushUS/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toHaveCount(0)
  })

  test('about page loads', async ({ page }) => {
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /About PushUS/i })).toBeVisible()
    await expect(page.getByText(/AGPL-3.0-only/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible()
  })

  test('join landing page loads', async ({ page }) => {
    await page.goto('/join')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Join a group/i })).toBeVisible()
    await expect(page.getByLabel(/Got an invite code/i)).toBeVisible()
  })

  test('join code page shows sign-in prompt for guests', async ({ page }) => {
    await page.goto('/join/testcode12')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /Sign in to join/i })).toBeVisible()
    await expect(page.getByText(/testcode12/i)).toBeVisible()
  })
})
