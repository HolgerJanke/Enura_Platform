# RUNBOOK — Enura Group BI: Navigation & Authorization Redesign

> **STATUS: APPROVED FOR EXECUTION — 2026-07-28.** Operator approved the plan with OD overrides
> (see §7 for the recorded resolutions). Phases run on `feat/nav-redesign-phase-N`; nothing merges to
> `main` without a separate explicit approval.
>
> **Provenance:** The originally-referenced source-of-truth runbook did not exist anywhere in the
> repo, git history, branches, stashes, sibling working dirs, or temp (see
> `docs/runlog-nav-redesign.md`, Finding F-001). On the operator's instruction, this document was
> **reverse-engineered** from the live codebase (three read-only investigations INV-A/B/C) and from
> `CLAUDE.md` + `docs/architecture.md`. It is a **spec proposed for approval**, not an authoritative
> spec. CLAUDE.md remains the higher architecture authority; on any conflict CLAUDE.md wins and the
> conflict is logged as a Finding.
>
> **This draft is not to be executed until the operator approves it** (see §7 Open Decisions and the
> approval gate). Nothing in §8's phases may begin before sign-off.

---

## 1. Purpose & Scope

### 1.1 What this redesign actually is
The task was framed as a "Navigation & Authorization redesign." Investigation shows the navigation
problems are **symptoms**; the root cause is that **authorization is not enforced server-side** in the
Company tier, so what a user can *see* (nav) and what a user can *reach* (routes/data) do not agree.

The redesign therefore has two coupled goals, in priority order:
1. **Install genuine server-side authorization** — a single policy that decides tier + role + module
   access, enforced in layouts/middleware/pages, so route access matches the permission set.
2. **Unify navigation on that same policy** — one config-driven nav per shell, derived from the policy,
   so **"visible ⇔ accessible"** by construction, replacing today's 7 ad-hoc hardcoded arrays.

### 1.2 In scope
- The three app shells: **Enura Group** (`apps/web/src/app/platform/*`), **Holding**
  (`(holding)/admin/*`), **Company** (`(dashboard)/*`).
- Server-side tier gates, role/module RBAC enforcement, navigation unification.
- Remediation of the tier-crossing leaks and the concrete security holes found (§2).

### 1.3 Out of scope (unless an approved decision pulls them in)
- New BI modules or KPI features; connector work; database schema redesign beyond what enforcement
  requires; the Supabase-dashboard JWT-key rotation / custom-token-hook steps in
  `docs/auth-middleware-graduation.md` (those are irreversible non-git ops → §9 Stop-Condition).
- **NOTE (OD-3 override):** wiring up the holding permission matrix (§5.3) is now **IN scope** per the
  operator's decision — it was previously listed here as a larger optional feature.

---

## 2. Current-State Findings (evidence base)

All items below are cited with `file:line` in `docs/runlog-nav-redesign.md`. Severity legend:
**[SEC]** security, **[ARCH]** architectural rupture, **[UX]** cosmetic/UX, **[DEAD]** dead code.

| # | Finding | Sev | Anchor |
|---|---------|-----|--------|
| C1 | Company `(dashboard)/*` has **no layout RBAC gate**; `requirePermission()` is a no-op pure boolean whose result is discarded on every module page → any authed company user loads any module. | **[SEC]** | `lib/permissions.ts:38`; `(dashboard)/setter/page.tsx:22` et al. |
| C2 | **Cross-tenant IDOR:** `(dashboard)/projects/[id]/page.tsx` — service-role client, no `company_id`, no perm check. | **[SEC]** | `projects/[id]/page.tsx:16-23` |
| C3 | `/debug` is in middleware `PUBLIC_PATHS` → unauthenticated info disclosure (env presence, anon-key prefix, DB error codes). | **[SEC]** | `middleware.ts:23`; `debug/page.tsx` |
| C4 | `/platform` access-denied is an inert 200 page (`redirect` imported, never called); middleware does no tier/role routing → `/platform` & `/admin` reachable from any hostname. | **[SEC]** | `platform/layout.tsx:16-27`; `middleware.ts` |
| C5 | Add-ons: Enura-tier nav links into Holding route `/admin/settings/addons`, and Enura-only cross-holding logic lives inside the Holding route tree. RLS backstop holds (not a raw §4.1 leak). | **[ARCH]** | `platform/layout.tsx:11`; `(holding)/admin/settings/addons/page.tsx` |
| C6 | **Latent bomb:** `(holding)/admin/layout.tsx:40` gates `isHoldingAdmin` only; 10+ child pages assume `\|\| isEnuraAdmin`. Naive layout fix exposes `/admin/secrets`,`/tools`,`/compliance` to pure Enura admins. | **[SEC]** | `(holding)/admin/layout.tsx:40` + child pages |
| C7 | `EnuraAdminBar` mounts in root layout on **every** tier via a client-side email-domain substring check → brand-isolation (§4.4) + trust divergence from `enura_admins`. | **[SEC]/[ARCH]** | `app/layout.tsx:48`; `EnuraAdminBar.tsx:26-48` |
| C8 | Dashboard shell embeds the full holding console (incl. secrets/tools) → assumes holding-admin-as-company-user, contradicting CLAUDE.md §7. | **[ARCH]** | `dashboard-shell.tsx:130-156` |
| C9 | Two permission schemes: real `module:{name}:{action}` (enforced where checked) + inert `holdings.permission_matrix` (only read-site queries a non-existent key) → the admin "Berechtigungsmatrix" is a no-op. | **[DEAD]/[SEC]** | `settings/permissions/actions.ts:53-83`; `processes/[id]/actions.ts:117-127` |
| C10 | Dead/duplicate nav: `HOLDING_ADMIN_BAR_NAV`, `SUPER_USER_NAV` defined but never rendered; nav = 7 hardcoded arrays + 1 DB source. | **[DEAD]** | `(holding)/admin/layout.tsx:13-21`; `(dashboard)/layout.tsx:9-15` |
| C11 | Legacy dead auth stack: `lib/auth.ts` (MockSession) + `stores/session.ts` (zustand) orphaned; `MOCK_AUTH` vestigial. | **[DEAD]** | `lib/auth.ts`; `stores/session.ts` |
| C12 | Minor namespace-mix / cosmetic: `/platform/holdings/[id]`→`/admin/companies/new` (F5); `AdminBar`/`EnuraAdminBar` "← Dashboard" ignores missing `companyId` (F7). | **[UX]** | see runlog INV-C F5/F7 |

---

## 3. Execution Model

### 3.1 Multi-agent model tiers
- **Orchestrator / Architect / Reviewer / final Verifier:** `fable` (high). Owns planning, sequencing,
  conflict decisions, final adversarial verification, sign-off. Also does all architecture,
  authorization-design, tier-leakage, and final security-review work.
- **Standard implementation agents:** `sonnet` (medium) — build a shell/module/test set per phase.
- **Adversarial verifiers:** `sonnet` (high) — job is to REFUTE every "done" claim.
- **Mechanical agents:** `haiku` (low) — route inventory, icon/i18n extraction, import renames, file moves.
- **Rule:** upgrade one tier whenever a task touches auth/security or is ambiguous; downgrade only for
  unambiguous mechanical work. **Never run security verification below `sonnet`/high.** Spawn parallel
  sub-agents for independent work; pipeline dependent work.

### 3.2 Per-phase protocol
Plan → fan-out to implementers → run the phase test gates and paste **RAW** output → adversarial verify
→ orchestrator signs off **only** when every acceptance criterion is CONFIRMED and all gates are green →
commit on branch `feat/nav-redesign-phase-N` (**never** on `main`). Keep the running record in
`docs/runlog-nav-redesign.md`: agents used, decisions (incl. every default taken), test results + path
to raw output, open Findings.

**Test gates** (run the applicable subset each phase; ALL in Phase 8):
```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm test:db && pnpm build
```
plus the generated **Role×Route authorization-matrix test** and the **axe a11y scan** of the three shells.
Only **NEW** failures vs. the Phase-0 baseline count — and there must be none.
> Gate caveats (Phase 0 to confirm & record): `test:db` is currently a placeholder echo (no wired pgTAP
> runner); `test:e2e` is Playwright under `@enura/web`. Baseline must capture exactly which gates run
> green, red, or are not-wired **today**, so "no new failures" is measured against reality.

---

## 4. Doctrine — No Guessing, Full Analysis
A criterion is met **only** when (a) a command verified it, (b) its raw output was read, and (c) an
independent verifier could not refute it. Never mark anything green from assumption or "should pass."
For **anything authorization-related, require TWO independent adversarial verifier passes** (e.g. "can a
`setter` load `/finance` by direct URL?", "does a Holding-Admin see an Enura-only item?", "can a Company
user reach `/admin`?", "can user of Company A open Company B's `/projects/[id]`?"). A criterion survives
only if **both** confirm.

**Non-negotiables (CLAUDE.md §4/§15):** TypeScript strict, no `any`, no `@ts-ignore`; permissions
enforced **server-side** (client visibility is comfort, not a boundary); tenant/tier isolation is
sacrosanct (no cross-tier links or data flow); brand tokens only (no hardcoded hex); no raw SQL strings;
no service-role client on user-facing paths. Work on branches; no merge to `main` without explicit approval.

---

## 5. Target Architecture & the Role×Route Authorization Matrix

### 5.1 Three formal tiers (formalizes Finding F-002)
| Tier | Shell / routes | Identity source | Entry gate (target) |
|------|----------------|-----------------|---------------------|
| **Enura Group** (top) | `app/platform/*` | row in `enura_admins` (`session.isEnuraAdmin`) | server redirect if `!isEnuraAdmin` |
| **Holding** (mid) | `(holding)/admin/*` | row in `holding_admins` (`session.isHoldingAdmin`) **only** (OD-2: Enura admins do NOT get implicit Holding entry; Enura-only surfaces live under `/platform`) | server redirect if `!isHoldingAdmin` |
| **Company** (leaf) | `(dashboard)/*` | `company_id` + `roles[]` from `profile_roles` | session + reset/2FA gate **+ per-route RBAC** |

### 5.2 Identity / flags / roles model
- **Tier flags** (`isEnuraAdmin`, `isHoldingAdmin`) come from `enura_admins` / `holding_admins`, are
  **orthogonal** to the per-company `roles` table, and are the sole basis for tier entry.
- **Per-company RBAC roles** (from `CLAUDE.md §7`): `super_user, geschaeftsfuehrung, teamleiter, setter,
  berater, innendienst, bau, buchhaltung, leadkontrolle` → resolved to `session.permissions: string[]`.
- **`holding:global`** is the holding-admin cross-company permission named in CLAUDE.md §7.
- The JWT gate-claims graduation (`docs/auth-middleware-graduation.md`) already carries `company_id` +
  `holding_id`; the target enforcement reads tier/role from the **verified session/claims only**, never
  client input.

### 5.3 Permission model (OD-3 RESOLVED = wire up)
Two enforced layers, cleanly separated so there is no ambiguity:
1. **Per-user RBAC — `module:{name}:{action}`** (actions `read|write|export|admin`; modules
   `setter|berater|leads|innendienst|bau|finance|reports|ai|admin`). This is the primary route/module
   gate for Company-tier users (the §5.6 matrix).
2. **Holding permission matrix (`holdings.permission_matrix`) — NOW WIRED UP (OD-3 override).** It is a
   *ceiling*, not a grant: a Holding admin uses it to **constrain what a tenant `super_user` may do**
   (e.g. disable `process.deploy`, `connector.credentials`, `user.impersonate` for a given tenant). The
   effective permission of a Company user = RBAC grant **∩** holding-matrix ceiling. Enforcement point:
   the same server-side authorization primitive (§5.4.2) consults the matrix for the actions it governs,
   read from the verified holding context (never client input). The existing broken read-site
   (`processes/[id]/actions.ts` querying a non-existent underscore key) is corrected to the canonical
   dotted keys in `PERMISSION_DEFINITIONS`. The admin UI (`settings/permissions`) is made to actually
   persist-and-enforce.

### 5.4 Server-side enforcement pattern (the core deliverable)
1. A single **authorization policy module** (e.g. `apps/web/src/lib/authz/policy.ts`) mapping
   `route/module → required tier + permission(s)` — the **single source of truth** consumed by BOTH
   enforcement and navigation.
2. A **real** enforcement primitive that actually blocks: `requirePermission`/`requireModule` **redirects
   or 404s** on failure (fixing the misnamed no-op). Name it unambiguously; keep the old name only as a
   thin redirecting wrapper if churn demands.
3. **Layout-level gates** per tier: Company `(dashboard)/layout.tsx` gains an RBAC gate; Holding &
   Platform layouts perform **real redirects** (not inert 200 pages).
4. **Data scoping** never relies on RLS where the service-role client is used on user-facing paths —
   every such query carries an explicit verified `company_id` (fixes C2 IDOR).
5. Middleware stays the auth-gate/branding layer; tier/route authorization lives in layouts+policy
   (documented so the two don't drift).

### 5.5 Target navigation (three shells, one policy)
- **One config-driven nav definition per shell**, each item annotated with the same policy key used for
  enforcement; the renderer shows an item **iff** the current session satisfies that key → *visible ⇔
  accessible*. Removes the 7 hardcoded arrays and both dead arrays (C10).
- **No cross-tier nav items.** Enura-only surfaces live under `/platform/*` (Add-ons relocated, C5).
  Any legitimate top-down action (e.g. Enura provisioning a company) uses an Enura-owned route, not a
  Holding URL (C12/F5).
- **`EnuraAdminBar`** either removed or rebuilt to (a) key off the **server-verified** `isEnuraAdmin`,
  (b) never render inside a tenant-branded Company page (brand isolation §4.4), (c) use brand tokens.
- **Process House** stays DB-driven but its `visible_roles` filtering is **also enforced server-side**
  on the target routes, not only in the client filter.

### 5.6 Role×Route authorization matrix (PROPOSED — derived from CLAUDE.md §7; operator confirms, OD-4)
Representative cells; the **generated matrix test** (Phase 7) is the exhaustive, authoritative form.
`✓` = allowed, `—` = denied (server-side). Tier flags `holding:global` / Enura are separate columns.

| Route (Company tier) | super_user | geschäftsf. | teamleiter | setter | berater | innendienst | bau | buchhaltung | leadkontrolle |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` (home) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/setter` | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — |
| `/berater` | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| `/leads` | ✓ | ✓ | ✓* | — | — | — | — | — | ✓ |
| `/innendienst` | ✓ | ✓ | — | — | — | ✓ | — | — | — |
| `/projects`, `/projects/[id]` | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — |
| `/finance`,`/cashflow-gantt`,`/liquidity/*`,`/finanzplanung/*` | ✓ | ✓ | — | — | — | — | — | ✓ | — |
| `/reports`, `/analytics` | ✓ | ✓ | ✓* | — | — | — | — | — | — |
| `/anomalies`, `/controlling` | ✓ | ✓ | — | — | — | — | — | — | — |
| `/settings/*` (users, branding, connectors, call-script, reports) | ✓ | — | — | — | — | — | — | — | — |

`*` = own-team scope only (teamleiter), pending OD-4 confirmation.
Cross-tier columns: **Holding admin** (`holding:global`) → `(holding)/admin/*` only, no Company module
by default (see OD-1); **Enura admin** → `/platform/*` only. Neither is a per-company role.

---

## 6. Global Definition of Done
The redesign is DONE only when **all** of the following are proven (raw output archived, adversarially
re-verified):
1. **All test gates green** with **zero new failures vs. the Phase-0 baseline**: `typecheck`, `lint`,
   `test`, `test:e2e`, `test:db` (or its documented not-wired status unchanged), `build`.
2. **Generated Role×Route authorization-matrix test passes** and covers every (role × company route)
   cell in §5.6 — each denied cell proven denied by direct-URL access returning a redirect/403/404, not
   just a hidden nav item.
3. **Two independent adversarial verifier passes** confirm, for the canonical probes: a `setter` cannot
   load `/finance` by URL; a Company-A user cannot open Company-B's `/projects/[id]`; a Company user
   cannot reach `/admin` or `/platform`; a Holding admin does not see an Enura-only item; a pure Enura
   admin cannot reach `/admin/secrets` unless OD-2 explicitly permits it.
4. **All [SEC] findings (C1–C4, C6, C7, C9) remediated and verified;** IDOR (C2) closed; `/debug` (C3)
   gated or removed; inert `/platform` denial (C4) replaced by real redirect.
5. **Navigation is policy-derived** in all three shells: no hardcoded nav array remains as the access
   authority, no dead nav arrays (C10), **visible ⇔ accessible** proven by the matrix test.
6. **No cross-tier leaks:** Add-ons relocated to an Enura-owned route (C5); `EnuraAdminBar` server-verified
   + brand-isolated (C7); dashboard-shell holding-console resolved per OD-1 (C8).
7. **axe a11y scan** of the three shells shows no new violations vs. baseline.
8. **No non-negotiable violated** (strict TS/no-`any`, server-side enforcement, tier isolation, brand
   tokens, no raw SQL, no service-role on user-facing paths without explicit verified scoping).
9. All work committed on `feat/nav-redesign-phase-N` branches; **nothing merged to `main`** without
   explicit operator approval; run-log complete.

---

## 7. Open Decisions — RESOLVED by operator 2026-07-28
> **Recorded resolutions:** OD-1 = **keep separate** (honor §7). OD-2 = **separate Enura surfaces to
> `/platform`**. OD-3 = **WIRE UP the permission matrix for real** (operator override of the recommended
> "retire" — expands scope; see §5.3/§8 Phase 6). OD-4 = matrix cells **as drafted** (§5.6). OD-5 =
> **delete** the legacy dead stack after a zero-consumer grep. These are now binding for §8 execution.

These were **structural forks** that alter the tier/permission model; per CLAUDE.md §0 they needed explicit
developer sign-off. Each had a **recommended default**; the operator's actual choices are recorded above.

- **OD-1 — Can one identity be both a Holding admin and a Company user?**
  CLAUDE.md §7 says holding admins are *not* tenant users (no `tenant_id`); the code (dashboard-shell,
  addons dual-gate) assumes they can be. *Recommended default:* **honor CLAUDE.md §7** — a Holding/Enura
  admin is not a Company user; remove the holding console embedded in the Company shell (C8); admins reach
  Holding tools only via the Holding shell.
- **OD-2 — Holding-layout gate (C6) resolution.**
  *Recommended default:* Do **not** simply add `|| isEnuraAdmin` to `(holding)/admin/layout.tsx:40`.
  Instead separate **Enura-only** surfaces (Add-ons cross-holding licensing) out to `/platform/*`, and
  keep `(holding)/admin/*` gated to `isHoldingAdmin` with a **resolved holding context**; if an Enura
  admin needs a specific holding's console, they enter it through an explicit holding selection, not an
  implicit null-context pass-through. This defuses the bomb without widening secret/tool access.
- **OD-3 — `holdings.permission_matrix` (C9): wire up or retire?**
  *Recommended default:* **Retire** the inert dot-separated scheme and its admin UI in this redesign
  (or reduce it to a read-only "coming soon" note), standardizing on `module:{name}:{action}`. Wiring it
  up is a larger feature and out of scope unless the operator wants it.
- **OD-4 — Confirm the §5.6 Role×Route matrix cells**, especially the teamleiter `*` own-team cells and
  whether `geschaeftsfuehrung` gets `/settings/*` (default: no; super_user only).
- **OD-5 — Legacy dead code (C11): delete `lib/auth.ts` + `stores/session.ts` + `MOCK_AUTH` remnants?**
  *Recommended default:* **Delete** after a confirming grep proves zero live consumers (Phase 6).

**Approval gate:** execution of §8 begins only after the operator (a) approves this runbook (as-is or
edited) and (b) resolves OD-1…OD-5 (or accepts the recommended defaults).

---

## 8. Phase Plan (0 → 8) with Acceptance Criteria
Each phase: implement on `feat/nav-redesign-phase-N`, run the applicable gates (raw output archived),
two adversarial passes for anything authz, orchestrator sign-off, commit. No phase starts until the prior
phase's criteria are all CONFIRMED.

**Phase 0 — Baseline & inventory.** Capture raw baseline for every gate (incl. which are green/red/not-
wired); regenerate the 98-route inventory; finalize current-state findings (§2). *Done when:* baseline
raw output archived and referenced in the run-log; findings reproduced with `file:line`.

**Phase 1 — Authorization policy core (no UI change).** Introduce the policy module (§5.4.1) as the single
source of truth + real enforcement primitive (§5.4.2) with unit tests. *Done when:* policy + primitive
exist, unit-tested; `typecheck`/`lint`/`test` green; no route behavior changed yet (proven).

**Phase 2 — Server-side tier & auth gates.** Real redirects for all three tier layouts (fix C4 inert
denial); fix `/debug` exposure (C3); resolve Holding-layout gate per OD-2 (C6). *Done when:* two
adversarial passes confirm Company/Enura/Holding entry is enforced by real redirect; `/debug` gated;
C6 bomb defused; gates green.

**Phase 3 — Company-tier RBAC + data scoping.** Apply the policy to every `(dashboard)` route (fix the
no-op `requirePermission`, C1); close the `/projects/[id]` IDOR with explicit verified `company_id` (C2).
*Done when:* matrix probes (§6.3) pass under two adversarial passes; IDOR closed; gates green.

**Phase 4 — Unified, policy-driven navigation (3 shells).** Replace the 7 hardcoded arrays + remove dead
arrays (C10) with policy-derived nav; *visible ⇔ accessible*. *Done when:* nav renders from policy; no
nav array is the access authority; adversarial pass finds no visible-but-forbidden or hidden-but-allowed
item; gates green.

**Phase 5 — Tier-leak & brand-isolation remediation.** Relocate Add-ons to an Enura-owned `/platform/*`
route (C5); rebuild/remove `EnuraAdminBar` to server-verified + brand-isolated (C7); resolve dashboard-
shell holding console per OD-1 (C8); fix C12/F5/F7. *Done when:* leak probes (§6.3) pass twice; no
cross-tier nav item; brand-isolation verified; gates green.

**Phase 6 — Permission-matrix wire-up & dead-code removal.** **WIRE UP** `holdings.permission_matrix` per
OD-3 (C9): correct the broken read-site to canonical dotted keys, make the primitive apply the matrix as
a ceiling on tenant `super_user` actions (effective = RBAC ∩ matrix), and make the admin UI persist-and-
enforce; delete legacy dead stack per OD-5 (C11) after zero-consumer grep. *Done when:* matrix toggles
demonstrably change a tenant super_user's server-side authorization (proven by test, both directions);
dead code gone; gates green.

**Phase 7 — Generated authz-matrix test + a11y.** Generate the exhaustive Role×Route test from the policy
(every §5.6 cell, denial proven by direct-URL access); axe scan of the three shells. *Done when:* matrix
test passes; axe shows no new violations.

**Phase 8 — Full gate run + final adversarial verification + DoD sign-off.** Run the **entire** gate set;
two final independent adversarial authz passes; verify every §6 DoD item. *Done when:* all §6 proven,
raw output archived, run-log complete. **Merge to `main` only on explicit operator approval.**

---

## 9. Stop-Conditions (return to operator; otherwise take the default and proceed)
Stop and surface to the operator **only** for:
1. **Structural RLS / tier-isolation break that cannot be done cleanly** — any change that would weaken
   RLS, allow a Company to bypass its Holding, a Holding to bypass Enura controls, or cross-tier data
   flow, where no clean in-branch fix exists (CLAUDE.md §0/§4.1).
2. **Irreversible, non-git actions** — production migrations, deploys, secret rotation, or the Supabase-
   dashboard JWT-key/hook steps in `docs/auth-middleware-graduation.md`. (Note: the platform already has
   a **leaked service_role key pending rotation** per project memory — rotation is operator-only.)
3. **An Open Decision (OD-1…OD-5) that materially changes tier structure** and was not pre-approved.
4. A finding that a "fix" would **break an existing feature/test/integration** with no clean path
   (no silent regressions — CLAUDE.md §0.5).

For everything else: take the runbook's default decision, record it in `docs/runlog-nav-redesign.md`,
and proceed.

---
*Draft generated 2026-07-27 by the orchestrator (`fable`) from live-codebase investigation. Awaiting
operator approval before any Phase-1+ execution.*
