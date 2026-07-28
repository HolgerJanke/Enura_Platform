# Run-Log — Enura Nav & Authorization Redesign

Orchestrator model: `fable`. Branch policy: work on `feat/nav-redesign-phase-N`, never `main`.

---

## 2026-07-27 — Phase 0 start / BLOCKED

### F-001 (BLOCKER, Stop) — Source-of-truth runbook is missing
- **Expected:** `docs/RUNBOOK-enura-navigation-authorization.md` (declared in the mandate as
  "this is your source of truth"; defines the 8 phases, per-phase acceptance criteria,
  the global Definition of Done §6, and the Stop-Conditions §9).
- **Verified absent** via:
  - `ls docs/` — only `anomaly-detection.md`, `architecture.md`, `auth-middleware-graduation.md`,
    `deployment.md`.
  - Repo-wide `find`/`grep` for `*runbook*`, `*nav*redesign*`, `*navigation*author*`,
    `RUNBOOK-enura-navigation` — no hit (only the unrelated `GODSMASHER_UNWIND_RUNBOOK.md`).
  - `git log --all --oneline -- docs/RUNBOOK-enura-navigation-authorization.md` — empty.
  - Scan of `git rev-list --all` trees — no matching path on any branch.
  - `git stash list` — empty.
  - Additional working dirs (IEP-Energy-Management-System, IEP-Price-Forward-Curve,
    Documents/Schweiz) and `/tmp`, `/private/tmp` — no hit.
- **Why this is a stop, not a default-and-proceed:** The mandate's meta-process (model tiers,
  per-phase protocol, test gates, non-negotiables) is reproduced in the prompt, but the
  *substance* — the target navigation structure, the Role×Route authorization matrix, the
  8 phases' deliverables, the acceptance criteria, DoD §6, and Stop-Conditions §9 — lives
  **only** in the missing runbook. Inventing it would be the single largest violation of the
  "NO GUESSING, FULL ANALYSIS" doctrine (runbook §4), and doing so for an *authorization*
  redesign is exactly the class of change CLAUDE.md §0 requires explicit developer approval for.
- **Action:** Halted before any code change. Awaiting the operator to supply the runbook
  (or its correct path). No files modified; no branch created.

### Phase-0 groundwork captured (spec-independent, reusable when unblocked)

**Test gates available** (root `package.json`):
- `typecheck` → `turbo run typecheck`; `lint` → `turbo run lint`; `test` → `turbo run test`;
  `build` → `turbo run build`.
- `test:e2e` → `pnpm --filter @enura/web test:e2e` (Playwright).
- `test:db` → placeholder only: `echo 'Run: supabase db test --db-url $DATABASE_URL'`
  (no wired pgTAP runner — flag for Phase 8).

**Three shells confirmed** (maps to the Enura Group → Holding → Company tiers):
| Shell (route group) | Tier | Layout |
|---|---|---|
| `/platform/*` | Enura Group (super-holding) | `apps/web/src/app/platform/layout.tsx` |
| `(holding)/admin/*` | Holding admin | `apps/web/src/app/(holding)/admin/layout.tsx` |
| `(dashboard)/*` | Company / tenant | `apps/web/src/app/(dashboard)/layout.tsx` |

**Route inventory:** 98 page/layout/route files under `apps/web/src/app` (full list captured
in session; regenerate with
`find apps/web/src/app -type f \( -name page.tsx -o -name layout.tsx -o -name route.ts \)`).

**Authorization / nav enforcement surface (starting points for later phases):**
- Middleware gate: `apps/web/src/middleware.ts`
- Permissions lib: `apps/web/src/lib/permissions.ts`
- Permission matrix UI: `apps/web/src/app/(holding)/admin/settings/permissions/permission-matrix-client.tsx`
- Nav: `packages/ui/src/Sidebar.tsx`, `apps/web/src/components/dashboard-shell.tsx`, `apps/web/src/lib/process-nav.ts`
- **Add-ons leak (called out in mandate non-negotiables):** `(holding)/admin/settings/addons/`
  is referenced from `apps/web/src/app/platform/layout.tsx` and `dashboard-shell.tsx` —
  candidate Platform→/admin tier-crossing to confirm & fix once the runbook defines intended behaviour.

**Baseline test-gate run:** deliberately NOT executed yet — a Phase-0 baseline is only
meaningful against the runbook's stated Phase-0 criteria, and the heavier suites (e2e/db)
have setup caveats above. Will capture the full baseline immediately on unblock.

### Decision D-001 — Operator resolution of F-001
Operator was surfaced F-001 and chose **"Draft a proposed runbook"**: reverse-engineer a
proposed 8-phase spec + Role×Route matrix + DoD from the codebase and CLAUDE.md, present for
**approval before any execution**. This is doctrine-compliant (spec-for-approval, not
guess-and-run; satisfies CLAUDE.md §0 developer-approval requirement). Execution stays blocked
until the operator signs off on the drafted runbook.

### Investigations dispatched (read-only, parallel) to source the draft
- INV-A (Explore/haiku): navigation inventory across the 3 shells.
- INV-B (general-purpose/sonnet): authorization enforcement model — roles, permission keys,
  server-side vs. client-only gating per sampled route, service-role-on-user-path scan.
- INV-C (general-purpose/sonnet): cross-tier leak audit, incl. the Add-ons Platform→/admin leak.

### Grounding note from docs (for the target design)
- CLAUDE.md §7 + docs/architecture.md §4.3: roles = {super_user, geschaeftsfuehrung, teamleiter,
  setter, berater, innendienst, bau, buchhaltung, leadkontrolle}; holding admin = `holding:global`,
  no tenant_id; permission keys `module:{module}:{action}` (read|write|export|admin).
- **Three shells, not two:** architecture.md documents only Holding + Tenant, but the route tree
  has a THIRD top shell `/platform/*` = Enura Group (super-holding, above Holding). The redesign
  must define this Enura-Group tier and its boundary vs. Holding explicitly. (Finding F-002.)
- docs/auth-middleware-graduation.md: middleware is graduating to JWT gate-claims carrying
  `company_id` + `holding_id` — the natural server-side signal for tier/role authorization.

### Investigation results digest (INV-A/B/C complete — evidence base for the draft)
**INV-A (nav):** 7 hardcoded nav arrays + 1 DB-driven source (Process House, `visible_roles`).
Dead code: `HOLDING_ADMIN_BAR_NAV`, `SUPER_USER_NAV` (defined, never rendered). Add-ons link in
BOTH `platform/layout.tsx:11` and `dashboard-shell.tsx:147`. `EnuraAdminBar` visibility = client-side
email-domain substring match.

**INV-B (authz enforcement) — the reframing finding:**
- Tier 3 `(dashboard)/*` has **no layout-level RBAC gate**; page-level `requirePermission()` is a
  **misnamed pure boolean** (`lib/permissions.ts:38`) whose return value is discarded on essentially
  every module page → **no server-side module enforcement**. Any authed company user can load any module.
- **IDOR:** `(dashboard)/projects/[id]/page.tsx:16-23` — service-role client, no `company_id`, no perm
  check → cross-tenant read. Concrete §4.1 violation.
- Two permission schemes: real `module:{name}:{action}` (enforced where checked) + inert dot-separated
  `holdings.permission_matrix` (its one read-site queries a non-existent key) → admin matrix UI is a no-op.
- `/debug` is in middleware `PUBLIC_PATHS` → unauthenticated info disclosure (env presence, anon-key
  prefix, DB error codes).
- `/platform` denial is an inert 200 page (`redirect` imported, never called). Middleware does **no**
  tier/role routing (branding + auth-gate only); `/platform` & `/admin` reachable from any hostname.
- Legacy dead stack: `lib/auth.ts` (MockSession) + `stores/session.ts` (zustand) orphaned; `MOCK_AUTH`
  vestigial, unread by middleware/session. **NB:** partially supersedes memory
  [[mock-auth-rls-service-client]] / [[real-auth-cutover-progress]] — to re-verify during execution
  before updating memory. Dashboard pages use the **service client with app-level `company_id` scoping**
  (so RLS is bypassed there — app-level scoping is the only tenant guard, which is why the IDOR bites).

**INV-C (tier leaks):**
- F1 Add-ons Platform→/admin: CONFIRMED architectural rupture (Enura logic+nav inside Holding tree);
  RLS backstop holds → not a raw §4.1 data leak. Manifests only for dual Enura+holding_admin identity.
- F2 **Ticking bomb:** `(holding)/admin/layout.tsx:40` gates `isHoldingAdmin` only; 10+ pages assume
  `|| isEnuraAdmin`. Naive layout fix would expose `/admin/secrets`, `/tools`, `/compliance` to pure
  Enura admins. Requires explicit access-model decision.
- F3 `EnuraAdminBar` (root `layout.tsx:48`) client email-heuristic on every tier → brand-isolation
  (§4.4) + client-trust divergence from `enura_admins`.
- F4 dashboard-shell embeds full holding console (incl. secrets/tools) → implies holding-admin-as-
  company-user, contradicting CLAUDE.md §7. Needs developer decision.
- F5 `/platform/holdings/[id]` links to `/admin/companies/new` (namespace-mix, minor).
- F6 company branding page → `/admin/settings/branding`, correctly gated by `holding:global` (by design).
- F7 `AdminBar`/`EnuraAdminBar` "← Dashboard" up-links ignore missing `companyId` (cosmetic).

### F-002 — "Enura Group / platform" is an undocumented THIRD tier
architecture.md documents only Holding + Tenant, but routes + `enura_admins`/`is_enura_admin()` +
`/platform/*` shell constitute a real Enura-Group tier above Holding. The redesign must formalize it.

### Open structural decisions surfaced (need operator sign-off — CLAUDE.md §0)
- OD-1: Can one identity be BOTH holding admin and company user? (CLAUDE.md §7 says no; code assumes yes.)
- OD-2: Holding-layout gate (F2) — should Enura admins traverse Holding pages (with resolved holding
  context) or should Enura-only surfaces be separated to `/platform/*`? Determines the Add-ons relocation.
- OD-3: Consolidate to the `module:{name}:{action}` RBAC and RETIRE or WIRE UP `holdings.permission_matrix`.
- OD-4: Exact Role×Route matrix cells (drafted from §7; operator to confirm).

### Milestone — proposed runbook DRAFTED, awaiting approval (blocked at approval gate)
Wrote `docs/RUNBOOK-enura-navigation-authorization.md` (STATUS: DRAFT). Faithful to mandate section
numbering (§3.1 tiers, §3.2 protocol, §4 doctrine, §6 DoD, §9 stop-conditions). Contains: 3-tier target,
consolidated permission model, server-side enforcement pattern, policy-driven nav, PROPOSED Role×Route
matrix, 9-item global DoD, 0→8 phase plan, and OD-1…OD-5 with recommended defaults. **No code touched.**
Execution of Phase 1+ is gated on operator approval + OD resolution. Awaiting operator.

---

## 2026-07-28 — APPROVED; Phase 0 (baseline & inventory)

### Decision D-002 — Operator approval + OD resolutions (binding)
Operator: **"Approve, with my OD overrides."** Recorded resolutions:
- **OD-1 = keep separate** (honor CLAUDE.md §7; admin ≠ company user; remove holding console from Company shell).
- **OD-2 = separate Enura surfaces to `/platform`** (defuse the C6 gate bomb; do NOT add `|| isEnuraAdmin` to holding layout).
- **OD-3 = WIRE UP the permission matrix** (override of recommended "retire"). Matrix = ceiling on tenant
  super_user actions; effective = RBAC ∩ matrix; fix broken read-site; make admin UI persist-and-enforce. **Scope +.**
- **OD-4 = matrix cells as drafted** (§5.6).
- **OD-5 = delete legacy dead stack** (`lib/auth.ts`, `stores/session.ts`, MOCK_AUTH remnants) after zero-consumer grep.
Runbook updated to APPROVED and these ODs marked RESOLVED. Proceeding to Phase 0.

### Phase 0 — baseline & inventory: COMPLETE ✅ (branch `feat/nav-redesign-phase-0`)
Raw gate output archived in `docs/baseline/*.txt`; summary in `docs/baseline/SUMMARY.md`. Verified by
reading raw output (doctrine §4a/b). Baseline to protect / freeze:
- `@enura/web` **typecheck ✅ / build ✅** (0 web TS errors; full Next build passes) — must stay green.
- `@enura/web` **test ✅ vacuous** (`--passWithNoTests`, no web tests exist yet).
- `@enura/web` **lint ❌ config-level** (2 parsing errors: middleware.ts, stores/session.ts) — pre-existing
  tooling misconfig, frozen; must not add new lint errors.
- `@enura/api` typecheck (7) + lint ❌ **pre-existing, OUT OF SCOPE** — frozen baseline; measure web in isolation.
- e2e ⚙️ wired (playwright + `tenant-isolation.spec.ts`), not runnable without Supabase env here.
- test:db ⛔ not wired (placeholder echo).
Route inventory: 98 files (captured Phase 0 start). Findings F-B1..F-B4 recorded in SUMMARY.
**Acceptance:** baseline captured, raw output read & archived, findings reproduced with file:line. CONFIRMED.
Committing Phase 0 docs (only redesign artifacts; operator's uncommitted work left untouched).
Phase 0 committed: `41962e9`.

### Phase 1 — authorization policy core: IN PROGRESS (branch `feat/nav-redesign-phase-0`)
Built (orchestrator-authored; authz design = fable tier per §3.1):
- `apps/web/src/lib/authz/policy.ts` — PURE single-source-of-truth: `Tier`, `sessionTiers`/`canEnterTier`
  (OD-1/OD-2 encoded: enura⊄holding, admins are not company users), `hasModulePermission` (NO admin
  auto-grant, unlike legacy `permissions.ts`), `isCapabilityAllowed` (OD-3 holding ceiling, default-allow),
  `ROUTE_RULES` table + `matchRouteRule` (longest-prefix), `decideAccess` (the one decision), `homeFor`.
  Route→permission map derived faithfully from seed `rolePermMap`.
- `apps/web/src/lib/authz/enforce.ts` — server-only wrappers `enforceAccess`/`enforceModule`/`getAccessDecision`
  that REALLY `redirect()` on deny (fixes C1 no-op pattern). Additive; call sites adopt in Phase 3.
- `apps/web/src/lib/authz/policy.test.ts` — 129 tests: full Role×Route matrix (9 roles × company routes),
  tier denials, longest-prefix, public paths, unauth, ceiling. Fixtures copied from seed.
Gates (raw in /tmp during session): web **typecheck 0 err ✅**, **test 129 pass ✅** (was vacuous),
web **build green ✅**. Additive-only PROVEN (no import of lib/authz outside authz/ → no route behavior changed).
**F-B1 root cause found:** `apps/web/.eslintrc.js` has `extends: []` (empty) → ESLint uses script-mode
parser → "import reserved" on every file; `eslint-config-next@14.2.21` IS installed. One-line fix
(`extends:['next/core-web-vitals']`) DEFERRED to a dedicated tooling step to avoid a codebase-wide lint
flood mid-authz-phase. Lint treated as non-functional-at-baseline; typecheck is the stronger guarantee.
**Adversarial verification (2 independent passes, sonnet/high):**
- V2 spec-conformance: **CONFIRMED**. No fixture drift (ROLE_PERMS == seed rolePermMap, all 9 roles),
  no incorrect matrix cell, OD-1/OD-2/§7 conform. Flagged: 6 coverage gaps + a runbook §5.1 doc-drift
  line — both **fixed** (test now 192→194; §5.1 reconciled to §7/OD-2).
- V1 correctness/bypass: no bypass in decideAccess/matchRouteRule/isPublicPath/enforce (prefix
  boundaries, longest-prefix, control-flow all sound). Found **F-P2 (real)**.

### F-P2 — dual-identity escalation (found by V1, FIXED)
`platform/holdings/new/actions.ts:264-307` (New-Holding onboarding) provisions a holding admin whose
profile ALSO has a `company_id` + `super_user` role — a shape that violates CLAUDE.md §7 ("holding
admins have no tenant_id") and OD-1. Original `sessionTiers` reflected the data → granted such a session
full Company-tier super_user access.
- **Fix (Phase 1, defense-in-depth):** `sessionTiers` now enforces the invariant — an `isHoldingAdmin`/
  `isEnuraAdmin` session is NEVER a Company-tier member, even with a stray `company_id`. Monotonic
  (strictly more restrictive → cannot create a bypass). Proven by new tests (`DUAL_IDENTITY_ADMIN` →
  denied /dashboard,/finance,/settings/users,/processes, routed to /admin). CLAUDE.md wins on conflict.
- **Deferred to Phase 5 (OD-1 data side):** correct the onboarding flow so it stops creating the
  §7-violating dual-identity shape (needs a small bootstrap decision: how the first company super_user
  is seeded). Policy guard neutralizes the escalation in the meantime.

### Phase 1 — SIGN-OFF ✅
Acceptance (runbook §8 Phase 1): policy + primitive exist ✅, unit-tested ✅ (**194 pass**), web
typecheck ✅ / build ✅ green, no route behavior changed ✅ (additive-only proven). Lint = F-B1
broken-at-baseline (deferred, not a regression). Both adversarial passes resolved (V2 confirmed; V1's
sole real finding fixed+tested). Will be re-attacked in Phase 8's final two-pass. **CONFIRMED.**
Committing on `feat/nav-redesign-phase-1`. Phase 1 committed: `a3e0ea3` (branch `feat/nav-redesign-phase-1`).

### Phase 2 — server-side tier & auth gates: IN PROGRESS (branch will be `feat/nav-redesign-phase-2`)
Approach decision: architecture.md §12 puts auth gates at the EDGE, and middleware already has a clean
`NextResponse.redirect` (proper 307, no content shipped, no Vercel layout-404 issue). So the AUTHORITATIVE
tier gate is in middleware; layouts are backstops. Company per-module RBAC stays for Phase 3.
Changes:
- `middleware.ts`: (a) removed `/debug` from `PUBLIC_PATHS`; (b) added edge tier-gate after the reset/2FA
  gate, before branding — `/platform`⇒isEnuraAdmin, `/admin`⇒isHoldingAdmin (OD-2 strict). Unauth on those
  tiers ⇒ /login; wrong-tier ⇒ `homeForFlags` (no loop). **Defuses C6**: a pure Enura admin is 307'd away
  before reaching /admin/secrets|tools|compliance. Reads enura_admins/holding_admins under the user client
  — parity with `lib/session.ts` (same table/query/JWT), so no lockout regression.
- `debug/page.tsx` (C3): `notFound()` unless `session.isEnuraAdmin`; stopped printing the anon-key prefix.
- `platform/layout.tsx` (C4): inert 200 "Zugriff verweigert" dead-end ⇒ real backstop redirect to `homeFor`.
- `(holding)/admin/layout.tsx`: backstop now routes denials via `homeFor` (was always `/dashboard`, wrong
  for a denied Enura admin). **Preserves operator's uncommitted nav edit** (removed cross-tier `/dashboard`
  back-link, added enura `→ /platform` up-link) — folded per D-003 below.
- `policy.ts`: added `homeForFlags` (edge-friendly, agrees with `homeFor`) + tests.
Gates: web **typecheck 0 ✅ / test 200 pass ✅ / build green ✅** (middleware edge-compiles, 113 kB, no warnings).

**Adversarial verification (2 passes):**
- V4 (C6/OD-2 tier-isolation): C6 defused for all page navigation ✅, OD-2 strict at tier-entry ✅,
  no holding/enura admin lockout in the LOGIC ✅, no redirect loops ✅. **Found: write-layer gap** — admin
  Server Actions still gated `isHoldingAdmin || isEnuraAdmin`; middleware is pathname-based and Server
  Actions POST to the current path, so the gate doesn't cover them (latent, not live). **FIXED**: tightened
  8 holding-tier action files to `isHoldingAdmin` only (compliance, processes/house, processes/[id]/kpis,
  secrets/new, secrets/[id]×3, tools/[id]×2, tools/new, roles). Deferred: addons actions (Enura+holding
  dual → Phase 5 relocation). Noted for Phase 5/6: processes/templates gates `isHoldingAdmin || isSuperUser`
  (company-super_user↔holding cross-tier, separate concern).
- V3 (bypass/redirect-loop): path-matching clean ✅, no redirect loops ✅, order-of-ops correct (no
  wrong-tier content/header leak) ✅, /debug fully closed ✅, admin /api routes self-gate ✅. **Found:
  F-P3 (CRITICAL, pre-existing).**

### F-P3 — holding-tier flag reads the wrong table; RLS blocks self-read (CRITICAL, PRE-EXISTING)
`lib/session.ts:42` (and my mirrored middleware read) query the **legacy** `holding_admins` table under the
user's JWT. VERIFIED in migrations: `013_update_rls_policies.sql` drops ALL policies (lines 37-47) and
re-adds for legacy `holding_admins` ONLY `USING is_enura_admin()` (§12) — **no `profile_id = auth.uid()`
self-read**. Same migration redefines `is_holding_admin()` to check **`holding_admins_v2`** and gives v2 a
proper self-read policy (`holding_admin_own_admins`), calling legacy the "old table, kept for backward compat."
⇒ a **pure** holding admin (not also enura) gets 0 rows from the legacy read ⇒ `session.isHoldingAdmin` is
**always false** for them ⇒ they cannot reach `/admin` (via the existing layout gate today, and via my edge
gate now — same outcome). Also: invite flow writes `holding_admins_v2` ONLY (not legacy); `removeHoldingAdmin`
deletes the global legacy row. **Consequence:** the holding console is effectively broken for pure holding
admins in the current code — independent of this redesign.
- **My Phase 2 change is PARITY-SAFE**: it mirrors `session.ts`'s existing read, so no NEW regression; the
  gate LOGIC is verified correct by both passes. The unreliable *signal* is the pre-existing bug.
- **Recommended fix:** read `holding_admins_v2` in `session.ts` + middleware (strictly better under real
  auth: v2's self-read policy is permissive where legacy's is absent; every grant path writes v2). BUT
  v2 data-completeness for already-provisioned admins is unverifiable without DB access, and prod-auth-mode
  is uncertain (memory [[mock-auth-rls-service-client]] MOCK_AUTH vs INV-B "cutover complete") — so this is
  a §9-class structural tier-identity decision. **ESCALATED to operator (see below).**
- Bonus (V3, latent): `014` `is_holding_admin()` ORs legacy (global, not holding-scoped) with v2 — a latent
  cross-holding risk if `profiles.holding_id` is ever reassigned without a matching v2 write. Note for §4.1.

**Phase 2 status:** gate LOGIC complete + double-verified + gates green; NOT committed pending F-P3.

### Decision D-004 — F-P3 resolution (operator)
Operator chose **"Switch to holding_admins_v2"** + **"Fold the F-P3 fix into Phase 2, commit once."**
Applied: `session.ts:42` and `middleware.ts:431` now read `holding_admins_v2` (the reads only; legacy
dual-write paths in holdings/new, holdings/[id], users/actions left untouched — harmless backward-compat).
Residual duality (legacy vs v2 tables, `014` is_holding_admin ORs both) noted for a later consolidation
(Phase 6 candidate). Pre-011 historical admins were moved to `enura_admins` by migration 011 (so covered
via isEnuraAdmin, or re-provisioned into v2) — accepted per operator decision.

### Phase 2 — SIGN-OFF ✅
Acceptance (runbook §8 Phase 2): Enura/Holding/Company entry enforced by REAL redirect (edge 307 in
middleware; layout backstops) ✅; `/debug` gated to Enura admins ✅ (C3); C6 bomb defused — pure Enura admin
307'd before /admin/* at BOTH read (page) and write (Server Action) layers ✅; inert /platform 200 denial
replaced ✅ (C4). Two adversarial passes: V3 (no bypass/loops) + V4 (C6 defused, OD-2 strict, no lockout)
— both resolved; V4's write-layer gap FIXED; V3's F-P3 FIXED per operator. Gates: web typecheck 0 ✅ /
test 200 ✅ / build green ✅. **CONFIRMED.** Committing on `feat/nav-redesign-phase-2` (folds operator's
nav edit per D-003). Phase 2 committed: `f1a89dd`.

### Phase 3 — Company-tier RBAC + data scoping: IN PROGRESS (branch will be `feat/nav-redesign-phase-3`)
- **Per-page RBAC** (sonnet implementer, orchestrator-specced): `await enforceModule([key])` added as first
  statement to 31 (dashboard) pages, key per ROUTE_RULES. Fixed C1 no-op (`requirePermission` result was
  discarded). Implementer also CORRECTED several pages checking the WRONG key (anomalies, settings/connectors
  were `module:admin:read`; call-script, settings/reports were `module:admin:write`). finanzplanung group (12
  pages): kept the real `requireFinanzplanung()` feature-flag gate, added `enforceModule(['module:finance:read'])`
  as defense-in-depth.
- **Company-tier layout gate** (orchestrator): `(dashboard)/layout.tsx` now redirects non-company-tier sessions
  (holding/enura admins, no-tier) via `canEnterTier(session,'company')` + `homeFor` — enforces OD-1 (admins
  routed to their own console). Entry-time check (tier can't change on soft-nav within the group).
- **C2 IDOR fix** (orchestrator): `projects/[id]/page.tsx` — added `enforceModule(['module:bau:read'])` +
  `.eq('company_id', session.companyId)` on the service-client project fetch. Cross-tenant read closed
  (foreign project → null → "nicht gefunden"). `projects.company_id` confirmed present.
- **liquidity/[companyId]/upload** (orchestrator): was a `'use client'` page (couldn't call server-only
  enforceModule). Restructured: client body → `upload-client.tsx`; new server `page.tsx` enforces
  `module:finance:read` then renders `<BankUploadClient/>`.
- Finding F-P4 (note): `lib/finanzplanung-guard.ts` references non-seeded key `module:finanzplanung:read` →
  `requireFinanzplanung` likely false for all non-admins (pre-existing; separate from Phase 3 RBAC). Log for later.
Gates: web **typecheck 0 ✅ / test 200 ✅ / build green ✅**.

**Adversarial verification (2 passes):**
- V5 (RBAC wiring): all 30 gated pages carry the CORRECT key before any fetch; layout tier-gate correct;
  upload mutation re-validates session+company; no redirect loops; NO cross-role/cross-tenant leak. One
  convention nit — projects/[id] gated after `await params` (verified NOT a leak) — **FIXED** (moved gate first).
- V6 (IDOR/data-scoping): **C2 IDOR CONFIRMED CLOSED**; full 13-file service-client sweep CLEAN (every query
  scoped by company_id or verified parent); liquidity/[companyId] verifies URL param vs session (not trusted).
  Finding: 2 lieferanten/[id] detail pages fetched suppliers via RLS client with no company_id belt (only
  pages lacking it; not exploitable today — suppliers RLS gates by company_id per mig 029) — **FIXED** (belt added).
  Logged (not tenant-isolation, out of Phase 3 scope): F-P5 finanzplanung updateInvoiceMatch same-tenant
  over-broad write (RLS-covered cross-tenant); F-P6 reviewBankDataChange/approve likely no-op (no company UPDATE
  policy on supplier_bank_change_requests) — both for Phase 6 review.

### Phase 3 — SIGN-OFF ✅
Acceptance (runbook §8 Phase 3): every (dashboard) route enforces its module permission server-side (C1
no-op fixed) ✅; company-tier layout gate (OD-1) ✅; projects/[id] IDOR closed with company_id scope (C2) ✅;
both adversarial passes confirm no cross-role/cross-tenant leak ✅. Gates: web typecheck 0 / test 200 / build
green ✅. **CONFIRMED.** Committing on `feat/nav-redesign-phase-3`. Phase 3 committed: `1c4514b`.

### Phase 4 — Navigation unification: IN PROGRESS (branch will be `feat/nav-redesign-phase-4`)
Nav is now cosmetic (server-side enforcement complete in Phases 2-3), so this is a UX/consistency phase
(visible ⇔ accessible), delegated to a sonnet implementer with lighter verification. Spec: single
`lib/nav/nav-config.ts` keyed to the policy; `filterNav(items, session)` using `canAccessRoute`/
`hasModulePermission`; remove dead arrays (HOLDING_ADMIN_BAR_NAV + unused AdminBar import; SUPER_USER_NAV);
policy-filter the dashboard-shell company super-user links. EXCLUDED (Phase 5): EnuraAdminBar heuristic,
Add-ons relocation, dashboard-shell Holding-admin section. Constraint: no change to any server-side access
check. Awaiting implementer + orchestrator verification.

### Phase 4 — SIGN-OFF ✅ (branch `feat/nav-redesign-phase-4`)
Implemented (sonnet implementer + orchestrator review): `lib/nav/nav-config.ts` — single per-shell config
(PLATFORM_NAV, HOLDING_NAV, COMPANY_ADMIN_NAV) + pure `filterNav(items, session)` using the SAME policy
functions as enforcement (`hasModulePermission`/`canEnterTier`/`canAccessRoute`) → visible ⇔ accessible by
construction. Layouts (platform/holding/dashboard) + dashboard-shell now render policy-filtered nav.
Removed dead arrays: `HOLDING_ADMIN_BAR_NAV` + unused `AdminBar` import, `SUPER_USER_NAV`.
Verification (PROPORTIONATE — nav is cosmetic; server-side enforcement unchanged & already double-verified in
P2/P3): reviewed nav-config (correct policy use), confirmed dead arrays gone, gates web typecheck 0 ✅ /
test 200 ✅ / build green ✅. No server-side access check altered (confirmed: middleware/enforce/ROUTE_RULES
untouched). Known deferred: Add-ons item is `always:true` and still points at the Holding route (visible to
Enura admins but middleware-blocked) — Phase 5 relocates it; EnuraAdminBar + dashboard-shell Holding-admin
section untouched (Phase 5). Behavioral correction: platform "← Dashboard" no longer shows for Enura admins
(OD-1-consistent). **CONFIRMED.** Committing on `feat/nav-redesign-phase-4`. Phase 4 committed: `d0fab66`.

### Phase 5 — tier-leak & brand-isolation remediation: IN PROGRESS (branch will be `feat/nav-redesign-phase-5`)
Security-relevant → full 2-pass adversarial verification. Delegated to sonnet implementer:
- C5: addons has TWO legit branches (Enura per-holding LICENSING; Holding per-company ACTIVATION). Split:
  Enura view → new `/platform/addons` (+ move `toggleHoldingFinanzplanung` there); `/admin/settings/addons`
  keeps Holding view only, gated isHoldingAdmin. nav-config PLATFORM_NAV 'Add-ons' → `/platform/addons` tier:enura.
- C7: EnuraAdminBar → presentational, driven by server-verified `isEnuraAdmin` prop from root `app/layout.tsx`
  (remove client cookie/email-substring heuristic). Fixes client-trust divergence + brand isolation (only real
  Enura admins see it; they're bounced from tenant (dashboard) pages by the P3 tier gate).
- C8: remove the dashboard-shell embedded Holding-admin console section (OD-1; dead under the P3 company-tier
  gate). Keep the Phase-4 policy-filtered company super-user section.
Awaiting implementer, then 2 adversarial passes (tier-isolation of the addons split + EnuraAdminBar/brand).

**Adversarial verification (2 passes):**
- V7 (addons split): **CLAIM HOLDS**. Tier isolation enforced at 4 layers each side (middleware 307 →
  layout → page → action), no `||` escape hatch, no orphaned imports/duplicate defs, scoping + functionality
  preserved. Only cosmetic: help/data.ts has no /platform/addons entry (consistent w/ other /platform routes).
- V8 (EnuraAdminBar/C8): **C7 fully resolved** (no cookie/email heuristic; server-verified from enura_admins),
  **C8 fully resolved** (no /admin/* in company shell; isHoldingAdmin prop gone). **Found: brand-isolation
  corollary not airtight** — the (dashboard) tier gate is a CLIENT-side `<script>` bounce, so the root layout's
  tenant brand CSS + EnuraAdminBar SSR before it fires; middleware branding is admin-unaware. Latent (no code
  path writes isEnuraAdmin+company_id today) but the F-P2 sibling shape is live.
  - **FIXED (orchestrator):** root `app/layout.tsx` now forces NEUTRAL branding for any admin session
    (`isEnuraAdmin || isHoldingAdmin`) — admins never receive a tenant's brand CSS/custom CSS, closing the
    §4.4 concern at the one place that knows both branding and admin flags. Gates green.

### Phase 5 — SIGN-OFF ✅ (branch `feat/nav-redesign-phase-5`)
Acceptance (runbook §8 Phase 5): Add-ons relocated to Enura-owned /platform/addons (C5) ✅; EnuraAdminBar
server-verified + brand-isolated (C7) ✅; dashboard-shell Holding console removed per OD-1 (C8) ✅; brand
isolation robustly enforced (admin ⇒ neutral branding) ✅. Two adversarial passes; both objectives confirmed;
brand corollary fixed. Gates web typecheck 0 / test 200 / build green ✅. **CONFIRMED.**
Committing on `feat/nav-redesign-phase-5`.
**Deferred (recorded):** (a) make the (dashboard) company-tier gate server-side/edge (perf-sensitive — needs
admin flags in JWT claims or a hot-path lookup); acute risk already neutralized by neutral-branding + per-page
enforceModule. (b) **F-P2 onboarding data-shape** (holdings/new creates holding_admin + company_id + super_user)
— needs an operator bootstrap decision (how the first company super_user is seeded); policy + branding defenses
in place meanwhile. (c) ~30 dead `session.isHoldingAdmin` branches in (dashboard) code (unreachable post P3
tier gate) — cleanup debt for Phase 6.

### Phase 6 — permission-matrix wire-up (OD-3) + dead-code removal (OD-5): SIGN-OFF ✅ (branch `feat/nav-redesign-phase-6`)
- **OD-3 wire-up (feature):** `lib/authz/capabilities.ts` — `loadHoldingMatrix(session)` (reads
  `holdings.permission_matrix` for the caller's own holding; company users can read their own holding row
  per RLS `holding_admin_own_holding`; default-allow / non-breaking on null), `checkCapability`,
  `enforceCapability` (server-action envelope). Fixed the broken read-site
  `(dashboard)/processes/[id]/actions.ts` (checked non-existent key `process_edit_redactional`) → now
  `enforceCapability(session,'process.version',…)` — a real tenant super_user capability (editorial process
  editing) genuinely constrained by the holding matrix. Admin UI already persists the matrix
  (`savePermissionMatrix`), so the loop is closed end-to-end. Tests: +2 proving the ceiling both directions
  for the wired keys. **Extensible:** other capability keys wire in by calling `enforceCapability` at their
  action sites (mechanism handles the rest) — documented as follow-up (not all 18 keys wired this pass).
- **OD-5 dead-code removal:** deleted the mock-auth cluster `lib/auth.ts` + `stores/session.ts` +
  `lib/mock-users.ts` (zero live consumers — confirmed via grep incl. a relative `./auth` import in
  mock-users that typecheck caught). MOCK_AUTH now survives only as a stale comment in `lib/tenant.ts` (harmless).
- Verification: PROPORTIONATE (narrowing ceiling — cannot cause cross-tenant/cross-role leak; pure ceiling
  unit-proven both directions). Gates: web typecheck 0 / test 202 / build green ✅. **CONFIRMED.**
- Deferred (recorded, not blocking DoD): F-P4 (finanzplanung-guard non-seeded `module:finanzplanung:*` keys —
  needs a finanzplanung-permission-model pass); F-P5/F-P6 (finanzplanung write-granularity / no-op review action);
  ~30 dead `isHoldingAdmin` branches in (dashboard) code; legacy/v2 holding_admins table consolidation. These
  are cleanup/robustness items, not security gaps in the redesigned surface.
Committing on `feat/nav-redesign-phase-6`. Phase 6 committed: `04a54a6`.

### Phase 7 — generated authz-matrix test + a11y: SIGN-OFF ✅ (branch `feat/nav-redesign-phase-7`)
- **Generated Role×Route matrix test** (`lib/authz/matrix.generated.test.ts`): iterates EVERY `ROUTE_RULES`
  entry (drift-proof — a new route can't escape coverage), deriving expected access from `anyOf ∩ role-perms`;
  asserts each cell's `decideAccess` (denials proven as `ok:false` + a redirect target, not a hidden nav item),
  cross-tier denials, a tier-coverage guard, and the §6.3 canonical probes. **195 generated tests; 397 total, all pass.**
  Scope: proves the POLICY decision for every cell; the HTTP-level proof (direct URL → 307) is the e2e (below).
- **Axe a11y scan** (`docs/a11y-shell-scan.md`): authored as an activate-ready Playwright+axe scaffold for the
  three shells. **Environment-gated** — needs `@axe-core/playwright` installed + a running app + Supabase auth;
  cannot run in this sandbox (same class as e2e/db; no a11y baseline existed at Phase 0). NOT claimed green;
  documented with exact activation steps. Committed as docs (not a live spec — would break `**/*.ts` typecheck
  without the dep).
Gates: web typecheck 0 / test 397 / build green. **CONFIRMED** (matrix test executable+passing; a11y authored/gated).
Committing on `feat/nav-redesign-phase-7`. Phase 7 committed: `602e539`.

### Phase 8 — full gate run + final adversarial verification + DoD sign-off (branch `feat/nav-redesign-phase-8`)
**Full gate run vs Phase-0 baseline — ZERO new failures:** web typecheck 0 (was 0), web test **397 pass**
(was 0/vacuous), web build green (was green), `@enura/api` typecheck **7** (baseline 7 — frozen, out of scope,
none added). lint = F-B1 config-broken (no NEW rule violations; +new files hit same parser bug, −3 deleted).
e2e / test:db / a11y = ENV-GATED (unchanged from baseline; need Supabase + deps this sandbox lacks).

**Two final holistic adversarial passes:**
- FV1 (integrated bypass hunt): probes 1,3,4,5,6,7,9 BLOCKED cleanly at cited server-side gates; probe 2
  (projects/[id] IDOR) BLOCKED. **Found: processes/[id] + versions residual** — the C4 pattern (redirect
  imported, never called; inert `<div>` denial) + a backwards ownership guard (`if (companyId && …)` skipped
  when companyId null). **FIXED (orchestrator):** both pages now scope the query by `company_id` (foreign/
  admin-null → not-found, projects/[id] pattern) and call a real `redirect()` on denial. Gates re-green.
- FV2 (DoD completeness + regression critic): **every §6 item MET or correctly ENV-GATED**; no fabricated
  green, no dropped [SEC] finding, no branch-hygiene violation (main/origin/main contain zero redesign commits).
  Regression critic: no over-restriction, no lockout, no redirect loops, dead-code removal clean.

**DEFINITION OF DONE (§6) — final status:**
1. Test gates, zero new failures vs baseline — **MET** (runnable) / **ENV-GATED** (e2e, test:db).
2. Generated Role×Route matrix test, every cell — **MET** (195 generated, 397 total pass).
3. Two adversarial passes confirm canonical probes — **MET** (FV1 all-blocked after processes fix; encoded in tests).
4. All [SEC] findings (C1-C4,C6,C7,C9) remediated + verified — **MET**.
5. Nav policy-derived, no dead arrays, visible ⇔ accessible — **MET**.
6. No cross-tier leaks (addons/EnuraAdminBar/dashboard-shell/brand) — **MET**.
7. axe a11y no new violations — **ENV-GATED** (authored scaffold; no baseline; not runnable here — NOT claimed green).
8. No non-negotiable violated — **MET** (no any/@ts-ignore/raw SQL/new hardcoded hex; service client scoped).
9. All on feat/nav-redesign-phase-N; nothing merged to main — **MET**.

**VERDICT:** DoD fully PROVEN for everything executable in this environment. Items 1(e2e/db) & 7(a11y) are
ENV-GATED — they need the operator's Supabase-connected CI + a11y dep; authored/wired but honestly not
claimed green. **STOPPING at the merge boundary per mandate — no merge to main without explicit approval.**

**Operator decisions still open (non-blocking for the branch, required before/at merge):**
- F-P1: /leads, /anomalies seed-permissiveness ruling (§5.6 vs seed). 
- F-P2: onboarding dual-identity data-shape (bootstrap decision).
- F-P4/5/6, dead isHoldingAdmin branches, legacy/v2 table consolidation, F-B1 lint config, client-JS
  company-tier bounce (edge-gate symmetry) — cleanup/robustness backlog.
Committing on `feat/nav-redesign-phase-8`. Phase 8 committed: `58e52fa`. Draft PR #18 opened (base main).

### Post-DoD operator decisions implemented (2026-07-28, on `feat/nav-redesign-phase-8`)
**F-P1 — operator: "tighten the seed for /leads & /anomalies".**
- Key discovery: the real DB seed `026_fix_role_permissions.sql` is ALREADY tighter than the mock —
  setter/berater/innendienst do NOT hold `module:leads:read`. So `/leads` was correct in PRODUCTION; the
  over-permissiveness was purely MOCK/TEST drift. Fixed: removed `module:leads:read` from those roles in the
  mock `rolePermMap` + both test fixtures. `/leads` = {super_user, gf, teamleiter, leadkontrolle}. No migration.
- `/anomalies`: in the DB, gf and teamleiter BOTH hold only `reports:read`, so no existing key separates them.
  Added a dedicated `module:anomalies:read` (migration `048`): super_user auto-holds it (all perms), gf
  auto-holds it (seed `module:%:read` pattern), teamleiter does NOT (explicit list) — no trigger change.
  Policy `/anomalies` → `module:anomalies:read`; **also updated the anomalies PAGE `enforceModule`** to match
  (the page is the real gate). `/anomalies` = {super_user, gf}. 397 tests pass (generated matrix auto-derived).
**F-P2 — operator: "Option A" (separate identities).**
- `platform/holdings/new/actions.ts`: onboarding now sets the holding admin's `company_id = null` and no
  longer assigns the first company's `super_user` role. The holding admin invites the company super_user
  separately (existing user-mgmt UI) + uses impersonation for tenant support. Forward fix only.
- Existing-data cleanup: `scripts/remediate-holding-admin-dual-identity.sql` — a DELIBERATELY-run
  (non-auto-applied) script to null `company_id` + drop company roles on existing holding-admin profiles.
  Touches live identities → operator applies after provisioning real company super_users.
Gates after both: web typecheck 0 / test 397 / build green ✅.
**New finding F-P7 (recorded, not fixed):** the test fixtures still drift from DB seed 026 in ways the
operator did NOT decide on — gf holds `module:%:read` incl. `module:admin:read` (→ could reach /settings),
innendienst lacks `bau:read` in DB (mock/tests say it can reach /projects), teamleiter lacks `ai:read` in DB.
The generated matrix reflects the MOCK, not the DB, for these. Reconciling the fixtures to the DB as the single
source of truth (or fixing the DB to §5.6) is a dedicated follow-up needing per-cell operator rulings.
Also minor: the (dashboard) critical-anomaly BANNER link to /anomalies shows to any company user (page bounces
non-management) — a tiny visible⇔accessible gap, not security.

### F-P7 — RESOLVED: reconcile the matrix to the authoritative DB seed (2026-07-28)
Derived the authoritative role→permission map from migrations 026 + 048 for the 9 §7 roles and reconciled all
three fixture sources (policy.test ROLE_PERMS, matrix.generated ROLE_PERMISSIONS, mock rolePermMap) to it, so the
generated matrix now reflects PRODUCTION. Only TWO cells changed route access; operator ruled on both:
- **D1 (grant innendienst /projects):** migration `049` adds `module:bau:read` to innendienst (back-fill +
  seed_company_roles trigger). /projects = {super_user, gf, innendienst, bau}. Fixtures already had it; DB now matches.
- **D2 (accept DB — gf reaches /settings/call-script + /settings/reports):** gf holds `module:admin:read` via the
  seed `module:%:read` pattern. Reconciled fixtures (gf gains admin:read) + EXPECTED /settings = {super_user, gf}.
  No migration. The pages already gate on module:admin:read (gf passes).
Non-route-affecting drift aligned to the DB (truthful fixtures, no behavior change): teamleiter −ai:read;
buchhaltung −finance:export; leadkontrolle −leads:export; gf reduced to reads-only (+admin:read). Gates: web
typecheck 0 / test 397 / build green ✅.
**Minor follow-ups noted (not blocking):** (a) gf now has *accessible-but-not-visible* /settings/call-script &
/settings/reports — the dashboard-shell "Admin Konsole" button is still gated by isSuperUser, so gf has no nav
link (access is correct; nav is a UX nicety). (b) SEPARATE larger gap: migration 028 creates 4 finanzplanung
roles + a `module:finanzplanung:*` scheme NOT represented in the matrix at all — a distinct reconciliation
needing its own pass (relates to F-P4).

### Leftovers #1 + #2 — DONE (operator: tackle both)
**#2 (nav for gf's settings):** dashboard-shell "Admin Konsole" button + Company-Admin section now gate on
`companyAdminNavItems.length > 0` (policy-derived) instead of `isSuperUser` — so gf (which holds admin:read →
Leitfaden + Berichte) gets the button + its 2 links; super_user still sees all 5. Removed the now-unused
`isSuperUser` prop (dashboard-shell + (dashboard)/layout). visible ⇔ accessible restored for this case.

**#1 (finanzplanung roles):** ROOT CAUSE found — the 4 dedicated finanzplanung roles (validator,
invoice_approver, cashout_planner, financial_approver; migration 028) hold only `module:finanzplanung:*`, NOT
`module:finance:read`. But Phase 3 gated /finanzplanung on `module:finance:read`, so **the dedicated roles were
locked out of their own module** (failed enforceModule before requireFinanzplanung ran). Fixed:
- Changed all 11 /finanzplanung pages' `enforceModule` + the ROUTE_RULES prefix to `module:finanzplanung:read`
  (matches the existing `requireFinanzplanung` guard). /finance, /cashflow-gantt, /liquidity, /controlling keep
  `module:finance:read`.
- Added the 4 finanzplanung roles to BOTH test fixtures with their 028 permissions; added `finanzplanung:read`
  to super_user + gf (gf holds it via seed `module:%:read`). Generated matrix now covers 13 roles. **549 tests pass.**
- /finanzplanung = {super_user, gf, validator, invoice_approver, cashout_planner, financial_approver}.
- **F-P4 RESOLVED:** the key IS seeded (028); Phase 3 just used the wrong one. requireFinanzplanung works for
  the seeded holders. 
- **Notes:** (i) buchhaltung is NOT in /finanzplanung (028 gave it finance:read, not finanzplanung:read) — it
  never saw finanzplanung CONTENT before either (requireFinanzplanung blocked it); this matches the dedicated-
  roles design. architecture.md §8 calls buchhaltung "Planer", but 028 created cashout_planner for that — a
  doc-vs-code point; grant buchhaltung finanzplanung:read via migration if you want it in. (ii) The MOCK
  seed-data does not model the finanzplanung module at all (pre-existing) — DB + test fixtures are authoritative.
  (iii) F-P6-adjacent: lieferanten/[id] references `module:finanzplanung:review_bank_data`/`approve_bank_data`
  keys that 028 does NOT seed → canReview/canApprove false for non-holding-admins (separate finanzplanung-perms pass).
Gates: web typecheck 0 / test 549 / build green ✅.

### Deferred findings backlog (to address in their phases)
- F-P1: /leads, /anomalies seed-permissiveness (matrix-cell review) — Phase 7/operator.
- F-P4: `finanzplanung-guard` uses non-seeded key `module:finanzplanung:read` — Phase 6.
- F-P5: finanzplanung `updateInvoiceMatch` same-tenant over-broad write — Phase 6.
- F-P6: `reviewBankDataChange`/`approve` likely no-op (no company UPDATE policy on supplier_bank_change_requests) — Phase 6.
- Legacy/v2 holding_admins table duality + `014` is_holding_admin ORs both — Phase 6 consolidation candidate.
- processes/templates gates `isHoldingAdmin || isSuperUser` (company-super_user↔holding cross-tier) — Phase 5/6.
- Systemic: 13 (dashboard) files use service client on user-facing paths (CLAUDE.md §15 tension) — tracked, compensated by explicit company_id scoping.

### Decision D-003 — operator's uncommitted layout edit
Operator chose "Fold it into the redesign." Their `(holding)/admin/layout.tsx` nav edit is preserved; Phase 2
gate fix layered on top; will be credited in the Phase 2 commit. Their tsbuildinfo + backlog .md files remain
untouched/unstaged.
