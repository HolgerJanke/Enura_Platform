import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Enura Platform E2E tests.
 *
 * Assumes the web app runs on localhost:3000 against a seeded Supabase instance.
 * In CI, the web server is started automatically via the webServer config.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One local retry absorbs Next.js dev first-compile flakes (a route's first hit
  // can be slow); CI keeps 2.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'pnpm --filter @enura/web dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Next.js dev cold-start (first compile) can exceed 30s.
    timeout: 120_000,
  },
})
