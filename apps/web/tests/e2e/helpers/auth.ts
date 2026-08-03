import type { Page } from '@playwright/test'

/**
 * Log in as a specific user via the login page.
 * Waits until the browser has navigated away from /login before returning.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from login (auth gate will send to dashboard or onboarding).
  // Generous timeout: Next.js dev compiles routes on first hit, which can exceed 10s.
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 45_000,
  })
}
