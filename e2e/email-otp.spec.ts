import { expect, test, type Page } from '@playwright/test'

const USER_ID = '00000000-0000-0000-0000-000000000001'

async function sendCode(page: Page) {
  await page.route('**/auth/v1/otp**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('pilot@example.com')
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click()
  await expect(page.getByLabel('Sign-in code')).toBeVisible()
}

test.describe('passwordless email code', () => {
  test('normalises the code and shows a safe invalid-code error', async ({ page }) => {
    let verifyBody: unknown
    await page.route('**/auth/v1/verify**', async (route) => {
      verifyBody = route.request().postDataJSON()
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Token has expired or is invalid' }),
      })
    })

    await sendCode(page)
    await page.getByLabel('Sign-in code').fill('12 34-56')
    await expect(page.getByLabel('Sign-in code')).toHaveValue('123456')
    await page.getByRole('button', { name: 'Sign in with code' }).click()

    expect(verifyBody).toMatchObject({
      email: 'pilot@example.com',
      token: '123456',
      type: 'email',
    })
    await expect(
      page.getByText('That code is invalid or expired. Request a new email and try again.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in with code' })).toBeEnabled()
  })

  test('creates a PWA-local session that survives a reload', async ({ page }) => {
    const now = Math.floor(Date.now() / 1000)
    const accessToken = [
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
      btoa(JSON.stringify({ sub: USER_ID, role: 'authenticated', exp: now + 3600 })),
      'test-signature',
    ].join('.')

    await page.route('**/auth/v1/verify**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: 'test-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: now + 3600,
          user: {
            id: USER_ID,
            aud: 'authenticated',
            role: 'authenticated',
            email: 'pilot@example.com',
            app_metadata: {},
            user_metadata: {},
            identities: [],
            created_at: new Date().toISOString(),
          },
        }),
      }),
    )
    await page.route('**/rest/v1/rpc/get_my_app_access**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          allowed: true,
          private_beta_enabled: false,
          can_create_group: true,
          has_group_access: false,
          is_allowlisted: true,
        }),
      }),
    )
    await page.route('**/rest/v1/profiles**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: USER_ID,
          display_name: 'Pilot',
          timezone: 'Australia/Sydney',
          onboarding_completed_at: new Date().toISOString(),
        }),
      }),
    )
    await page.route('**/rest/v1/group_members**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )

    await sendCode(page)
    await page.getByLabel('Sign-in code').fill('123456')
    await page.getByRole('button', { name: 'Sign in with code' }).click()
    await expect(page).toHaveURL(/\/group\/create$/)

    const authKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.endsWith('-auth-token')),
    )
    expect(authKeys).toEqual(['sb-127-auth-token'])

    await page.reload()
    await expect(page).toHaveURL(/\/group\/create$/)
    await expect(page.getByRole('heading', { name: /Create/i })).toBeVisible()
  })
})
