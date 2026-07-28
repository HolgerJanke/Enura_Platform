# Phase-0 Baseline — Test Gate Snapshot (2026-07-28)

Branch: `feat/nav-redesign-phase-0`. Raw output in sibling files (`typecheck.txt`, `lint.txt`,
`web-lint.txt`, `web-test.txt`, `web-build.txt`). This is the reference the DoD's
**"no NEW failures vs. Phase-0 baseline"** is measured against. Only regressions relative to this
table count; pre-existing red is frozen, not owned by this redesign.

| Gate | Scope | Baseline result | Detail |
|------|-------|-----------------|--------|
| typecheck | `@enura/web` | ✅ PASS (0 errors) | **Protect — must stay green.** |
| typecheck | `@enura/api` | ❌ FAIL (7 errors) | Pre-existing, OUT OF SCOPE: `imapflow` missing module (email-incomer.ts), unused vars (invoice-extraction/matching, whatsapp-approval), `totals.currency` string\|undefined mismatch. Frozen baseline. |
| lint | `@enura/web` | ❌ FAIL (config) | 2 ESLint **parsing** errors ("keyword 'import' is reserved") on `src/middleware.ts`, `src/stores/session.ts`. Next.js ESLint plugin "not detected" warning. Tooling misconfig, not code violations. `stores/session.ts` is dead code slated for deletion (OD-5). |
| lint | `@enura/api` | ❌ FAIL | Pre-existing ESM/CJS loader error. OUT OF SCOPE. |
| test (unit) | `@enura/web` | ✅ PASS (vacuous) | `vitest run --passWithNoTests` — **no web test files exist**. The authz policy/matrix tests added in Phases 1/7 will be the first. |
| build | `@enura/web` | ✅ PASS | Full Next.js production build succeeds; all ~98 routes compile. **Protect — must stay green.** |
| test:e2e | `@enura/web` | ⚙️ WIRED, not run here | `playwright.config.ts` + `tests/e2e/tenant-isolation.spec.ts` (+ `helpers/auth.ts`). Requires a running app + Supabase; not executable in this sandbox without env. Record pass/fail when an env is available; Phase 8 must run it. |
| test:db | root | ⛔ NOT WIRED | Script is a placeholder `echo 'Run: supabase db test ...'`. No pgTAP runner. Flag: DoD item #1 treats "unchanged not-wired status" as acceptable; do not claim green. |

## Baseline Findings (carried into execution)
- **F-B1 (lint config):** web ESLint cannot parse ESM `import` in `middleware.ts`/`stores/session.ts`.
  Pre-existing. Fixing the Next lint integration is a candidate cleanup (Phase 4/6) but is not required
  by DoD beyond "no new lint failures." If touched, do it deliberately and log it.
- **F-B2 (no web tests):** the unit-test gate is currently vacuous; there is no existing coverage to
  regress. New tests must genuinely pass, not `--passWithNoTests`.
- **F-B3 (test:db unwired):** RLS/pgTAP cannot be exercised via `pnpm test:db` today. Tenant-isolation
  proof at DoD relies on the e2e `tenant-isolation.spec.ts` + adversarial direct-URL probes instead.
- **F-B4 (api red frozen):** `@enura/api` typecheck+lint are red independent of this redesign; the web
  work must not add to them. Measure web gates in isolation (`pnpm --filter @enura/web ...`).
