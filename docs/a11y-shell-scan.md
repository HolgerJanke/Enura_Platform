# Axe a11y scan — the three shells (Phase 7 deliverable)

**Status: LIVE (2026-08-03).** Implemented as `apps/web/tests/e2e/a11y-shells.spec.ts`, runs as
part of `pnpm test:e2e` (Chromium-scoped — axe violations are DOM-based, so one engine suffices).
`@axe-core/playwright` is installed. Current coverage:
- **company `/dashboard`** (session: `m.krings@alpen-energie.ch`) — PASSES.
- **enura `/platform`** (session: `admin@enura-group.com`, an `enura_admins` row) — PASSES.
- **holding `/admin`** — SKIPPED: no holding-admin account with known creds. The seed writes the
  admin to legacy `holding_admins`, but the app reads `holding_admins_v2` (F-P3), and the only v2
  holding admin (`h.janke@enura-energie.de`) has no seeded password. Enable once a holding-admin
  fixture with known creds exists in `holding_admins_v2`.

**First-run findings (all fixed in the same change):**
- `meta-viewport`: `maximumScale: 1` removed from `app/layout.tsx` (WCAG 1.4.4 — pinch-zoom).
- `color-contrast` in `ProcessHouseView.tsx`: phase/step rows were missing `bg-white` (the code
  comment already said "on white background"), so muted text sat on the 20% brand-tint. Added
  `bg-white`; darkened `text-gray-400`→`600`, `TrendArrow` green/red→`700` and its flat case→`600`;
  accent-process header switched from white to `text-gray-900` on the amber accent.

Note the scan runs on `localhost` where `DEV_HOLDING_ADMIN=true` forces the neutral/default brand
palette; the fixes above are robust because they hold on white / any light tint. A future pass
could also assert contrast under a real tenant palette (see [[hosted-dev-db-stale-seed]] on the host flag).

_Original scaffold notes (kept for reference):_ There was no a11y baseline at Phase 0, so
"no new violations vs. baseline" is measured from this first run.

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
