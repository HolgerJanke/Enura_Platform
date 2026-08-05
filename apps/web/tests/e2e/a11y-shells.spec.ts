import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginAs } from './helpers/auth'

/**
 * Accessibility scan of the three redesigned tier shells (WCAG 2.0 / 2.1 level A & AA
 * via axe-core). The Nav & Authorization redesign rebuilt the chrome of all three tiers
 * — company `dashboard-shell`, holding `admin` shell, enura `platform` shell — so each is
 * scanned as rendered for a real session of the matching tier.
 *
 * Sessions (scripts/seed-dev.ts):
 *   - company: m.krings@alpen-energie.ch  (super_user)      → /dashboard
 *   - enura:   admin@enura-group.com       (enura admin)     → /platform
 *   - holding: holding@alpen-gruppe.ch     (holding admin)   → /admin
 *
 * There was no a11y baseline before the redesign, so this is the first measurement:
 * treat any violation as a real finding.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function dismissCookieBanner(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'Verstanden' })
  if (await btn.count()) await btn.first().click().catch(() => {})
}

async function shellViolations(page: Page, path: string) {
  await page.goto(path)
  // The shells render a top-level <main> landmark; wait for it rather than networkidle
  // (TanStack Query background refetch can keep the network busy indefinitely).
  await page.waitForSelector('main', { timeout: 20_000 })
  await dismissCookieBanner(page)
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return violations
}

function summarize(violations: Awaited<ReturnType<typeof shellViolations>>): string {
  return JSON.stringify(
    violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
    null,
    2,
  )
}

test.describe('A11y — redesigned tier shells', () => {
  // a11y violations are DOM-based (engine-agnostic): run once, on Chromium, to avoid
  // doubling runtime and Firefox-specific axe quirks.
  test.skip(({ browserName }) => browserName !== 'chromium', 'a11y scan runs once (chromium)')

  test('company dashboard shell has no axe violations', async ({ page }) => {
    await loginAs(page, 'm.krings@alpen-energie.ch', 'Super@Alpen2026!')
    const violations = await shellViolations(page, '/dashboard')
    expect(violations, summarize(violations)).toEqual([])
  })

  test('enura platform shell has no axe violations', async ({ page }) => {
    await loginAs(page, 'admin@enura-group.com', 'Admin@Enura2026!')
    const violations = await shellViolations(page, '/platform')
    expect(violations, summarize(violations)).toEqual([])
  })

  test('holding admin shell has no axe violations', async ({ page }) => {
    await loginAs(page, 'holding@alpen-gruppe.ch', 'Holding@Alpen2026!')
    const violations = await shellViolations(page, '/admin')
    expect(violations, summarize(violations)).toEqual([])
  })
})
