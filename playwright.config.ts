import { defineConfig, devices } from '@playwright/test'

const mobileChrome = {
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/today-mobile.spec.ts', '**/mobile-layout.spec.ts'],
    },
    {
      name: 'mobile-chrome',
      use: mobileChrome,
      testMatch: ['**/today-mobile.spec.ts', '**/mobile-layout.spec.ts'],
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: process.env.CI
      ? 'npm run dev -- --host 127.0.0.1 --port 4173 --mode e2e'
      : 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
