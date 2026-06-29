import { test, expect, type Page } from '@playwright/test'
import { createLocalMemberSession } from './localAuth'

let memberSession: string | null = null

async function seedAuthSession(page: Page) {
  if (!memberSession) return

  await page.addInitScript((sessionValue) => {
    window.localStorage.setItem('sb-127-auth-token', sessionValue)
  }, memberSession)
}

async function gotoTodayReady(page: Page) {
  await page.goto('/today', { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: /Bank Push-ups/i })).toBeVisible({
    timeout: 20_000,
  })
}

async function assertLogNavContained(page: Page) {
  const nav = page.getByRole('navigation', { name: /Main navigation/i })
  const logBtn = page.getByRole('button', { name: /Log push-ups/i })
  const navBox = await nav.boundingBox()
  const logBox = await logBtn.boundingBox()

  expect(navBox).not.toBeNull()
  expect(logBox).not.toBeNull()

  if (navBox && logBox) {
    expect(logBox.y).toBeGreaterThanOrEqual(navBox.y - 1)
    expect(logBox.y + logBox.height).toBeLessThanOrEqual(navBox.y + navBox.height + 1)
  }
}

async function assertLogPageHeroOrder(page: Page) {
  const ring = page.locator('svg[role="slider"]')
  const bank = page.getByRole('button', { name: /Bank Push-ups/i })
  const plan = page.getByTestId('day-progress-card')
  const entries = page.getByRole('heading', { name: /Today's entries/i })

  const ringBox = await ring.boundingBox()
  const bankBox = await bank.boundingBox()
  const planBox = await plan.boundingBox()
  const entriesBox = await entries.boundingBox()

  expect(ringBox).not.toBeNull()
  expect(bankBox).not.toBeNull()
  expect(planBox).not.toBeNull()
  expect(entriesBox).not.toBeNull()

  if (ringBox && bankBox && planBox && entriesBox) {
    expect(ringBox.y + ringBox.height).toBeLessThanOrEqual(bankBox.y + 2)
    expect(bankBox.y + bankBox.height).toBeLessThanOrEqual(planBox.y + 2)
    expect(planBox.y + planBox.height).toBeLessThanOrEqual(entriesBox.y + 2)
  }

  await assertLogNavContained(page)
}

async function setRingCount(page: Page, target: number) {
  const ring = page.locator('svg[role="slider"]')
  await ring.focus()

  const current = Number(await ring.getAttribute('aria-valuenow'))
  const delta = target - current

  if (delta > 0) {
    for (let i = 0; i < delta; i += 1) {
      await page.keyboard.press('ArrowUp')
    }
  } else if (delta < 0) {
    for (let i = 0; i < Math.abs(delta); i += 1) {
      await page.keyboard.press('ArrowDown')
    }
  }

  await expect(ring).toHaveAttribute('aria-valuenow', String(target))
}

test.describe.configure({ mode: 'serial' })

test.describe('today mobile layout', () => {
  test.beforeAll(async () => {
    memberSession = await createLocalMemberSession()
  })

  test.beforeEach(async ({ page }) => {
    if (!memberSession) {
      test.skip()
    }
    await seedAuthSession(page)
    await page.addInitScript(() => {
      window.localStorage.removeItem('pushus.ring-hint-v1')
    })
  })

  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`layout at ${viewport.width}x${viewport.height} — count 0 shows hint and hero order`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      const bank = page.getByRole('button', { name: /Bank Push-ups/i })
      await expect(page.getByText('Drag the ring to bank more')).toBeVisible()
      await expect(bank).toBeDisabled()
      await expect(page.getByText('Private beta')).toHaveCount(0)
      await assertLogPageHeroOrder(page)
    })

    test(`layout at ${viewport.width}x${viewport.height} — count 1 enables bank with hero order`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      await setRingCount(page, 1)

      const bank = page.getByRole('button', { name: /Bank Push-ups/i })
      await expect(bank).toBeEnabled()
      await expect(page.getByTestId('bank-disabled-hint')).toHaveCount(0)
      await assertLogPageHeroOrder(page)
    })

    test(`layout at ${viewport.width}x${viewport.height} — count 7 keeps hero order`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      await setRingCount(page, 7)
      await assertLogPageHeroOrder(page)
    })

    test(`layout at ${viewport.width}x${viewport.height} — count 10 keeps hero order`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      await setRingCount(page, 10)
      await assertLogPageHeroOrder(page)
    })
  }

  test('touch ring at bottom snaps count without keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoTodayReady(page)

    const ringHit = page.getByTestId('logger-ring-hit')
    const hitBox = await ringHit.boundingBox()

    expect(hitBox).not.toBeNull()

    if (hitBox) {
      await page.mouse.click(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height - 6)
    }

    const ring = page.locator('svg[role="slider"]')
    await expect(ring).toHaveAttribute('aria-valuenow', '6')
  })

  test('ring handle stays visible at zero after drag hint dismissed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      window.localStorage.setItem('pushus.ring-hint-v1', '1')
    })
    await gotoTodayReady(page)

    const ring = page.locator('svg[role="slider"]')
    await expect(ring.locator('[data-testid="logger-handle-visible"]')).toHaveCount(1)
    await expect(page.getByText('Drag the ring', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Drag the ring to bank more')).toBeVisible()
    await assertLogPageHeroOrder(page)
  })

  test('log page scrolls when swiping outside the ring', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoTodayReady(page)

    const entriesHeading = page.getByRole('heading', { name: /Today's entries/i })
    await entriesHeading.scrollIntoViewIfNeeded()

    const scrollBefore = await page.evaluate(() => window.scrollY)
    await page.mouse.move(195, 500)
    await page.mouse.down()
    await page.mouse.move(195, 350, { steps: 8 })
    await page.mouse.up()

    const scrollAfter = await page.evaluate(() => window.scrollY)
    expect(scrollAfter).not.toBe(scrollBefore)
  })
})
