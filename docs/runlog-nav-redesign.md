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
