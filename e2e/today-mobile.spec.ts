import { test, expect, type Page } from '@playwright/test'
import { createLocalMemberSession } from './localAuth'

let memberSession: string | null = null

async function seedAuthSession(page: Page) {
  if (!memberSession) return

  await page.addInitScript((sessionValue) => {
    window.localStorage.setItem('sb-127-auth-token', sessionValue)
  }, memberSession)
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap = 2,
) {
  return !(
    a.x + a.width <= b.x + gap ||
    b.x + b.width <= a.x + gap ||
    a.y + a.height <= b.y + gap ||
    b.y + b.height <= a.y + gap
  )
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

async function assertTodayLayoutNoOverlap(page: Page) {
  const bank = page.getByRole('button', { name: /Bank Push-ups/i })
  const nav = page.getByRole('navigation', { name: /Main navigation/i })
  const entriesHeading = page.getByRole('heading', { name: /Today's entries/i })

  await expect(entriesHeading).toBeVisible()

  const bankBox = await bank.boundingBox()
  const navBox = await nav.boundingBox()
  const entriesBox = await entriesHeading.boundingBox()

  expect(bankBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(entriesBox).not.toBeNull()

  if (bankBox && navBox) {
    expect(rectsOverlap(bankBox, navBox)).toBe(false)
    expect(bankBox.y + bankBox.height).toBeLessThanOrEqual(navBox.y + 1)
  }

  if (entriesBox && bankBox) {
    expect(entriesBox.y).toBeGreaterThanOrEqual(bankBox.y + bankBox.height - 4)
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
    test(`layout at ${viewport.width}x${viewport.height} — count 0 shows hint and no overlap`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      const bank = page.getByRole('button', { name: /Bank Push-ups/i })
      await expect(page.getByText('Drag the ring to bank more')).toBeVisible()
      await expect(bank).toBeDisabled()
      await assertTodayLayoutNoOverlap(page)
    })

    test(`layout at ${viewport.width}x${viewport.height} — count 1 enables bank without overlap`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      await setRingCount(page, 1)

      const bank = page.getByRole('button', { name: /Bank Push-ups/i })
      await expect(bank).toBeEnabled()
      await expect(page.getByTestId('bank-disabled-hint')).toHaveCount(0)
      await assertTodayLayoutNoOverlap(page)
    })

    test(`layout at ${viewport.width}x${viewport.height} — count 7 has no overlap`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      await setRingCount(page, 7)
      await assertTodayLayoutNoOverlap(page)
    })

    test(`layout at ${viewport.width}x${viewport.height} — count 10 has no overlap`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await gotoTodayReady(page)

      await setRingCount(page, 10)
      await assertTodayLayoutNoOverlap(page)
    })
  }

  test('ring handle stays visible at zero after drag hint dismissed', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      window.localStorage.setItem('pushus.ring-hint-v1', '1')
    })
    await gotoTodayReady(page)

    const ring = page.locator('svg[role="slider"]')
    await expect(ring.locator('circle[r="10"]')).toHaveCount(1)
    await expect(page.getByText('Drag the ring', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Drag the ring to bank more')).toBeVisible()
    await assertTodayLayoutNoOverlap(page)
  })
})
