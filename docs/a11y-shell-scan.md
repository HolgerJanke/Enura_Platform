# Axe a11y scan — the three shells (Phase 7 deliverable)

**Status: authored scaffold, environment-gated.** This scan cannot run in the build sandbox
(it needs `@axe-core/playwright` installed **and** a running app + Supabase test tenants +
authenticated sessions per tier) — the same class of environment gate as `test:e2e` / `test:db`
(see `docs/baseline/SUMMARY.md`, F-B3). There was no a11y baseline at Phase 0 (no a11y infra
existed), so "no new violations vs. baseline" is measured from first run in a proper environment.

## Activate

1. Install the dependency (updates the lockfile — run in a networked env):
   ```bash
   pnpm --filter @enura/web add -D @axe-core/playwright
   ```
2. Drop the spec below into `apps/web/tests/e2e/a11y-shells.spec.ts`.
   > NOTE: it is kept out of the repo as live code because `apps/web/tsconfig.json` includes
   > `**/*.ts`, so a spec importing an uninstalled `@axe-core/playwright` would fail `typecheck`.
   > Add it only after step 1.
3. Provide authenticated storage states per tier (reuse `tests/e2e/helpers/auth.ts`), then:
   ```bash
   pnpm --filter @enura/web test:e2e
   ```

## Spec

```ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// One authenticated context per tier is required — a company super_user for /dashboard,
// a holding admin for /admin, an enura admin for /platform (wire via storageState /
// tests/e2e/helpers/auth.ts). Each shell must be reachable and rendered before analyze().
const SHELLS = [
  { name: 'Company dashboard shell', path: '/dashboard', storage: 'company' },
  { name: 'Holding admin shell',     path: '/admin',     storage: 'holding' },
  { name: 'Enura platform shell',    path: '/platform',  storage: 'enura'   },
] as const

for (const shell of SHELLS) {
  test(`a11y: ${shell.name} has no axe violations`, async ({ page }) => {
    await page.goto(shell.path)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(
      results.violations,
      JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.length })), null, 2),
    ).toEqual([])
  })
}
```

## What it covers
The three tier shells (`platform-shell`, `holding-shell`, `dashboard-shell`) as rendered for a
real session of the matching tier — the nav, header, and modal chrome the redesign touched.
Run it in CI alongside `test:e2e`; treat any violation as a Phase-8 blocker per DoD §6.7.
