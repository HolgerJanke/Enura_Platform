import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

/**
 * E2E tests verifying tenant isolation, role-scoped routing, and brand injection.
 *
 * Test users (seeded by pnpm seed:dev):
 *   - l.weber@alpen-energie.ch  (Setter role, Alpen Energie tenant)
 *   - m.fischer@alpen-energie.ch (Geschaeftsfuehrung role, Alpen Energie tenant)
 *   - s.mueller@test-company.ch  (Setter role, Test Company tenant)
 *
 * These tests assume the web app is running against a seeded Supabase instance.
 */

// ---------------------------------------------------------------------------
// Role-based access control
// ---------------------------------------------------------------------------

test.describe('Role-based module access', () => {
  test('Setter cannot navigate to finance module', async ({ page }) => {
    await loginAs(page, 'l.weber@alpen-energie.ch', 'Test@2026!setter')

    // Attempt to navigate directly to /finance
    await page.goto('/finance')

    // Should be redirected away (to dashboard or access-denied)
    await expect(page).not.toHaveURL(/\/finance/)
  })

  test('Finance sidebar item not visible for setter', async ({ page }) => {
    await loginAs(page, 'l.weber@alpen-energie.ch', 'Test@2026!setter')

    // Wait for the navigation to be rendered
    await page.waitForSelector('nav')

    const financeLink = page.locator('nav a[href="/finance"]')
    await expect(financeLink).toHaveCount(0)
  })

  test('Setter sidebar shows setter module link', async ({ page }) => {
    await loginAs(page, 'l.weber@alpen-energie.ch', 'Test@2026!setter')

    await page.waitForSelector('nav')

    const setterLink = page.locator('nav a[href="/setter"]')
    await expect(setterLink).toBeVisible()
  })

  test('Geschaeftsfuehrung can access finance module', async ({ page }) => {
    await loginAs(
      page,
      'm.fischer@alpen-energie.ch',
      'Test@2026!geschaeftsfuehrung',
    )

    await page.goto('/finance')

    // Should stay on finance (not redirected)
    await expect(page).toHaveURL(/\/finance/)
  })
})

// ---------------------------------------------------------------------------
// Brand injection
// ---------------------------------------------------------------------------

test.describe('Tenant branding', () => {
  test('Dashboard renders with alpen-energie brand-primary', async ({
    page,
  }) => {
    await loginAs(page, 'l.weber@alpen-energie.ch', 'Test@2026!setter')

    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-primary')
        .trim(),
    )

    // Alpen Energie brand primary is #E25C20
    expect(primary.toLowerCase()).toBe('#e25c20')
  })

  test('Logo data attribute is set', async ({ page }) => {
    await loginAs(page, 'l.weber@alpen-energie.ch', 'Test@2026!setter')

    const logoUrl = await page.evaluate(() =>
      document.documentElement.getAttribute('data-logo'),
    )

    expect(logoUrl).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Cross-tenant isolation (browser level)
// ---------------------------------------------------------------------------

test.describe('Cross-tenant data isolation', () => {
  test('Alpen-energie user does not see test-company data in leads table', async ({
    page,
  }) => {
    await loginAs(page, 'l.weber@alpen-energie.ch', 'Test@2026!setter')

    // Navigate to leads if accessible, or dashboard
    await page.goto('/leads')

    // The page should not contain any reference to the other tenant's data.
    // We check that "Test Company" does not appear in the page content.
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('Test Company GmbH')
  })

  test('Test-company user does not see alpen-energie data', async ({
    page,
  }) => {
    await loginAs(page, 's.mueller@test-company.ch', 'Test@2026!setter')

    await page.goto('/leads')

    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('Alpen Energie')
  })
})

// ---------------------------------------------------------------------------
// Auth gates
// ---------------------------------------------------------------------------

test.describe('Authentication gates', () => {
  test('Unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login/)
  })

  test('User with must_reset_password is sent to /reset-password', async ({
    page,
  }) => {
    // This user has must_reset_password = true (first login with temp password)
    await loginAs(
      page,
      'new.user@alpen-energie.ch',
      'TempPassword@2026!',
    )

    await expect(page).toHaveURL(/\/reset-password/)
  })

  test('User without TOTP enrolled is sent to /enrol-2fa', async ({
    page,
  }) => {
    // This user has reset password but totp_enabled = false
    await loginAs(
      page,
      'no.totp@alpen-energie.ch',
      'Test@2026!nototp',
    )

    await expect(page).toHaveURL(/\/enrol-2fa/)
  })
})
