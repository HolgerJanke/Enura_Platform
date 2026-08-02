import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

/**
 * E2E: tenant isolation, server-side role/tier authorization, and brand injection —
 * aligned with the Nav & Authorization redesign (server-side enforcement; the company
 * "sidebar" was replaced by the Process House + an "Admin Konsole" modal) and the
 * actual users created by `pnpm seed:dev`.
 *
 * Seeded users (scripts/seed-dev.ts):
 *   - l.weber@alpen-energie.ch    / Test@2026!setter        (setter,      Alpen Energie)
 *   - a.steiner@alpen-energie.ch  / Test@2026!buchhaltung   (buchhaltung, Alpen Energie)
 *   - m.krings@alpen-energie.ch   / Super@Alpen2026!        (super_user,  Alpen Energie)
 *   - admin@test-company.ch       / Super@Test2026!         (super_user,  Test Company)
 *
 * Requires the app running against a seeded Supabase instance (Playwright starts it).
 */

const SETTER = { email: 'l.weber@alpen-energie.ch', pw: 'Test@2026!setter' }
const BUCHHALTUNG = { email: 'a.steiner@alpen-energie.ch', pw: 'Test@2026!buchhaltung' }
const SUPER_USER = { email: 'm.krings@alpen-energie.ch', pw: 'Super@Alpen2026!' }
const TESTCO_ADMIN = { email: 'admin@test-company.ch', pw: 'Super@Test2026!' }

// ---------------------------------------------------------------------------
// Server-side company-tier RBAC (the redesign's core: enforced on the server,
// not by hiding nav). A denied route must REDIRECT, not render.
// ---------------------------------------------------------------------------

test.describe('Company-tier RBAC (server-side)', () => {
  test('setter is denied /finance by direct URL', async ({ page }) => {
    await loginAs(page, SETTER.email, SETTER.pw)
    await page.goto('/finance')
    await expect(page).not.toHaveURL(/\/finance/)
  })

  test('setter is denied /berater by direct URL', async ({ page }) => {
    await loginAs(page, SETTER.email, SETTER.pw)
    await page.goto('/berater')
    await expect(page).not.toHaveURL(/\/berater/)
  })

  test('setter CAN access its own /setter module', async ({ page }) => {
    await loginAs(page, SETTER.email, SETTER.pw)
    await page.goto('/setter')
    await expect(page).toHaveURL(/\/setter/)
  })

  test('buchhaltung CAN access /finance', async ({ page }) => {
    await loginAs(page, BUCHHALTUNG.email, BUCHHALTUNG.pw)
    await page.goto('/finance')
    await expect(page).toHaveURL(/\/finance/)
  })

  test('buchhaltung is denied /setter by direct URL', async ({ page }) => {
    await loginAs(page, BUCHHALTUNG.email, BUCHHALTUNG.pw)
    await page.goto('/setter')
    await expect(page).not.toHaveURL(/\/setter/)
  })
})

// ---------------------------------------------------------------------------
// Cross-tier isolation: a company user cannot reach the Holding/Enura consoles
// (edge tier-gate in middleware).
// ---------------------------------------------------------------------------

test.describe('Cross-tier isolation', () => {
  test('company super_user cannot reach the Holding console (/admin)', async ({ page }) => {
    await loginAs(page, SUPER_USER.email, SUPER_USER.pw)
    await page.goto('/admin')
    await expect(page).not.toHaveURL(/\/admin/)
  })

  test('company super_user cannot reach the Enura console (/platform)', async ({ page }) => {
    await loginAs(page, SUPER_USER.email, SUPER_USER.pw)
    await page.goto('/platform')
    await expect(page).not.toHaveURL(/\/platform/)
  })
})

// ---------------------------------------------------------------------------
// Redesigned nav: the "Admin Konsole" button (dashboard-shell) is shown only
// when the session has company-admin links it may reach (policy-derived),
// replacing the old module sidebar.
// ---------------------------------------------------------------------------

test.describe('Admin Konsole visibility (nav ⇔ access)', () => {
  test('setter does NOT see the Admin Konsole button', async ({ page }) => {
    await loginAs(page, SETTER.email, SETTER.pw)
    await expect(page.locator('button[aria-label="Admin Konsole"]')).toHaveCount(0)
  })

  test('super_user sees the Admin Konsole button', async ({ page }) => {
    await loginAs(page, SUPER_USER.email, SUPER_USER.pw)
    await expect(page.locator('button[aria-label="Admin Konsole"]')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Tenant branding: the signed-in user's own company brand is injected as CSS
// custom properties before paint. Alpen Energie primary is #E25C20 (seed).
// ---------------------------------------------------------------------------

test.describe('Tenant branding', () => {
  // NOTE on host: bare `localhost` is treated as the HOLDING-ADMIN console when
  // DEV_HOLDING_ADMIN=true (a common local dev flag) — the middleware then renders
  // neutral branding by design (isAdminHost() short-circuits). To assert the *tenant*
  // branding path independently of that flag, drive a real tenant host: `*.localhost`
  // resolves to loopback in both bundled browsers, does NOT start with "localhost" (so
  // isAdminHost() is false), and a signed-in user resolves their own company's brand via
  // resolveBrandByCompanyId(sessionCompanyId). Login + assertion share this host so the
  // session cookie stays valid.
  test.use({ baseURL: 'http://alpen-energie.localhost:3000' })

  test('dashboard renders with the alpen-energie brand-primary', async ({ page }) => {
    await loginAs(page, SETTER.email, SETTER.pw)
    // Wait for the brand var to be present, then assert its value.
    await page.waitForFunction(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim().length > 0,
    )
    const primary = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim(),
    )
    expect(primary.toLowerCase()).toBe('#e25c20')
  })
})

// ---------------------------------------------------------------------------
// Cross-tenant data isolation (browser level). Uses the real seeded company
// display names: "Alpen Energie GmbH" and "Test Company AG".
// ---------------------------------------------------------------------------

test.describe('Cross-tenant data isolation', () => {
  test('Alpen user does not see Test Company data on /leads', async ({ page }) => {
    await loginAs(page, SETTER.email, SETTER.pw)
    await page.goto('/leads')
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('Test Company AG')
  })

  test('Test Company user does not see Alpen Energie data on /leads', async ({ page }) => {
    await loginAs(page, TESTCO_ADMIN.email, TESTCO_ADMIN.pw)
    await page.goto('/leads')
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('Alpen Energie')
  })
})

// ---------------------------------------------------------------------------
// Authentication gates
// ---------------------------------------------------------------------------

test.describe('Authentication gates', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  // The reset-password and 2FA-enrolment gates (CLAUDE.md §4.2) are enforced by
  // middleware + authGateRedirect() (unit-tested), but e2e coverage needs users
  // seeded in those states. seed-dev.ts currently hardcodes every user to
  // must_reset_password:false / totp_enabled:true, so these are skipped until the
  // seed grows dedicated fixtures (a must_reset_password:true user and a
  // totp_enabled:false user).
  test.skip('user with must_reset_password is sent to /reset-password', async () => {})
  test.skip('user without TOTP enrolled is sent to /enrol-2fa', async () => {})
})
