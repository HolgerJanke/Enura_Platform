# CLAUDE.md — Enura Group BI Platform
## Development Guardrails & Architectural Reference

> This file is the single source of truth for Claude Code.
> Read it fully before writing any code. Every decision made here has a reason.
> When in doubt, refer back to this file before proceeding.

---

## 0. Change Validation Protocol

**Every proposed change must be validated against the existing codebase before implementation.**

### Rules

1. **Check before changing.** Before modifying any file, function, type, database table,
   or architectural pattern, verify what already exists. Read the relevant files. Understand
   the current implementation. Do not assume — inspect.

2. **Flag structural conflicts.** If a proposed change contradicts the current architecture
   (e.g. bypassing the three-tier hierarchy, breaking the branding inheritance chain,
   violating the RLS isolation model, or circumventing the permission matrix), **stop and
   explicitly inform the developer** before proceeding. State clearly:
   - What the current structure is
   - How the proposed change conflicts with it
   - What the consequences would be (data leakage, broken cascades, type mismatches, etc.)

3. **Ask for confirmation.** When a conflict is identified, ask the developer:
   *"This change would [describe impact]. The current system works as [describe current behaviour].
   Do you want to proceed with this change?"*
   Do not silently make changes that alter the hierarchical structure.

4. **Hierarchical integrity.** The platform follows a strict three-tier hierarchy:
   **Enura Group → Holding → Company**. Any change that would:
   - Allow a Company to bypass its Holding
   - Allow a Holding to bypass Enura Group controls
   - Remove or weaken RLS tenant isolation
   - Break the branding/permission/process inheritance chain
   - Allow data to flow outside its scoped tier

   must be flagged as a **structural rupture** and requires explicit developer approval
   with documented justification.

5. **No silent regressions.** If a change would break an existing feature, test, or
   integration — even if the change itself is correct in isolation — flag it. The developer
   must be aware of all downstream effects before approving.

---

## 1. Platform Overview

### What This Is
A **multi-tenant Business Intelligence platform** built for the Enura Group. The holding company
uses it to monitor operations across all subsidiary companies from a single interface.
Each subsidiary company gets its own **isolated, branded environment** — their own subdomain,
their own colour scheme, their own logo, and access only to their own data.

### The Two Worlds
| Layer | Who | What they see |
|-------|-----|---------------|
| **Holding layer** | Holding admins | All companies, all data, cross-company analytics |
| **Tenant layer** | Company users | Only their own company's data, in their own branding |

These two worlds must **never bleed into each other**. A tenant user must be
architecturally incapable of seeing another tenant's data — not just filtered out in code,
but blocked at the database level via Row-Level Security.

### Reference Company (Pilot Tenant)
**Alpen Energie GmbH** — Swiss PV & heat pump installer based in the Lastenheft.
Use this as the reference implementation for all BI modules. Their data model,
roles, and KPIs are the canonical example. See Section 9 for their full module list.

---

## 2. Monorepo Structure

```
/
├── apps/
│   ├── web/                  # Next.js 14 (App Router) — frontend
│   └── api/                  # Fastify — backend / connector workers
├── packages/
│   ├── types/                # Shared TypeScript types (Database, Tenant, Role, etc.)
│   ├── ui/                   # Shared React component library (brand-aware)
│   └── config/               # Shared ESLint, Prettier, tsconfig base
├── supabase/
│   ├── migrations/           # Numbered SQL migration files
│   ├── seed.sql              # Dev seed data
│   └── schema.sql            # Full schema reference (source of truth)
├── docs/
│   ├── architecture.md
│   ├── connectors.md
│   └── roles.md
├── CLAUDE.md                 # ← this file
└── package.json              # Root workspace config (pnpm workspaces)
```

**Package manager**: `pnpm` with workspaces. Never use `npm` or `yarn`.
**Node version**: 20 LTS minimum.
**Language**: TypeScript strict mode throughout. No `any` types. No `// @ts-ignore`.

---

## 3. Technology Stack

### Frontend — `apps/web`
| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Next.js 14 (App Router) | Server components, middleware, SSR for branding |
| Language | TypeScript 5.x strict | Type safety across the full stack |
| Styling | Tailwind CSS + CSS custom properties | Brand tokens injected as CSS vars at runtime |
| Components | Radix UI primitives + custom wrappers | Accessible, unstyled, brand-agnostic |
| Forms | React Hook Form + Zod | Schema-driven validation matching API types |
| Data fetching | TanStack Query | Cache management, background refresh for KPIs |
| Charts | Recharts | Lightweight, composable, works with custom colors |
| Auth client | Supabase JS client (`@supabase/ssr`) | SSR-compatible session handling |
| State | Zustand (minimal global state only) | Tenant config, user session |

### Backend — `apps/api`
| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Fastify | Performance, typed plugins, schema validation |
| ORM | Prisma | Type-safe queries, migration tooling |
| Validation | Zod | Shared schemas with frontend via `packages/types` |
| Job queue | BullMQ (Redis-backed) | Connector sync jobs, email report generation |
| Email | Resend | Transactional email with React templates |
| AI | Anthropic SDK (`claude-sonnet-4-6`) | Call analysis, daily report generation |
| Testing | Vitest | Fast, ESM-native |

### Database & Infrastructure
| Concern | Choice |
|---------|--------|
| Primary DB | Supabase (PostgreSQL 15 + TimescaleDB) |
| Cache | Upstash Redis (serverless-compatible) |
| Object storage | Supabase Storage (S3-compatible) |
| Auth | Supabase Auth (with TOTP 2FA) |
| Hosting | Vercel (web) + Railway or Fly.io (API) |
| Region | **EU / Switzerland only** — DSG/DSGVO compliance non-negotiable |

---

## 4. Absolute Rules — Never Violate These

These are hard constraints. Claude Code must refuse to generate code that breaks them.

### 4.1 Tenant Isolation
```
RULE: Every database query that touches tenant-scoped data MUST include
      tenant_id scoping. No exceptions.
```
- The Supabase client for authenticated requests uses the user's JWT, which triggers RLS automatically.
- For service-role queries in the API (connector sync jobs, background workers), always explicitly
  filter by `tenant_id`. Never use the service role client for user-facing requests.
- The `current_tenant_id()` and `is_holding_admin()` Postgres functions are the RLS gatekeepers.
  Do not bypass them.

### 4.2 Authentication Gates
```
RULE: No route, page, or API endpoint is accessible without:
      (a) a valid Supabase session
      (b) must_reset_password = false
      (c) totp_enabled = true
      Exception: /login, /reset-password, /enrol-2fa
```
- Middleware in `apps/web/middleware.ts` enforces this on every request.
- The API enforces this via a Fastify `preHandler` hook on every route plugin.
- These checks must happen server-side. Never rely on client-side redirects alone.

### 4.3 Password & 2FA Policy
- Temporary passwords are set by admin/super user. They are bcrypt-hashed via Supabase Auth.
- On first login, the user is redirected to `/reset-password` regardless of what URL they requested.
- After password reset, they are redirected to `/enrol-2fa` if `totp_enabled = false`.
- Only after both steps are complete does the user reach their dashboard.
- Session tokens expire after 8 hours. Refresh tokens rotate on every use.

### 4.4 Brand Isolation
```
RULE: The UI must never render with the wrong tenant's branding, even for
      a single frame. Branding is resolved server-side, before first paint.
```
- Subdomain is detected in `middleware.ts`, tenant config is fetched server-side,
  CSS custom properties are injected into the `<html>` element before hydration.
- Components must use `var(--brand-primary)` etc., never hardcoded hex values.
- See Section 6 for the full brand token system.

### 4.5 Data Residency
- All Supabase projects must be in the EU (Frankfurt) or Switzerland region.
- Call recordings (3CX) are stored in Supabase Storage — EU region only.
- No third-party analytics (Google Analytics, Mixpanel, etc.) without explicit sign-off.
- AI API calls (Anthropic) are used for call analysis only. No customer PII is sent in prompts.
  Transcripts are anonymised before being passed to the Claude API.

### 4.6 No Raw SQL in Application Code
- All database access goes through Prisma (API) or the Supabase JS client (web).
- Exception: TimescaleDB-specific queries (time_bucket, continuous aggregates) may use
  Prisma's `$queryRaw` with tagged template literals. Never string concatenation.

---

## 5. Architecture Patterns

### 5.1 Tenant Resolution Flow
```
Request → middleware.ts
  → extract subdomain (company-a from company-a.platform.com)
  → fetch tenant config from Supabase (cached in Redis, TTL 5 min)
  → if not found → redirect to /not-found
  → inject tenant_id into request context
  → inject brand tokens as CSS custom properties
  → proceed to route handler
```

### 5.2 API Layer Pattern
Every Fastify route plugin follows this structure:
```typescript
// apps/api/src/routes/leads/index.ts
export default async function leadsPlugin(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate)  // validates JWT
  fastify.addHook('preHandler', fastify.requireTenant) // extracts tenant_id

  fastify.get('/', {
    schema: { querystring: GetLeadsQuerySchema },
    handler: async (request, reply) => {
      const { tenantId } = request.tenant  // always from verified context, never user input
      // ... query with tenantId
    }
  })
}
```
The `tenantId` always comes from the **verified JWT / server context**, never from
request body, query params, or headers supplied by the client.

### 5.3 Data Access Pattern (Web)
```typescript
// Always use server components for initial data load
// apps/web/app/(dashboard)/leads/page.tsx
export default async function LeadsPage() {
  const supabase = createServerClient()  // uses user's session cookie
  const { data } = await supabase.from('leads').select('*')
  // RLS automatically scopes to current user's tenant
  return <LeadsTable initialData={data} />
}

// Client components use TanStack Query for subsequent fetches
// RLS still applies — the client uses the same session
```

### 5.4 Mock Data Layer (Pre-Supabase)
Until Supabase is connected, all data access goes through a thin abstraction:
```typescript
// packages/types/src/data-access.ts
export interface DataAccess {
  leads: LeadsRepository
  offers: OffersRepository
  calls: CallsRepository
  // ...
}

// During development: mock implementation
// After Supabase setup: Supabase implementation
// The interface never changes — only the implementation swaps
```
Do not hardcode mock data inline in components. All mocks live in `packages/types/src/mocks/`.

### 5.5 Background Job Pattern (Connector Sync)
```
Scheduler (cron) → BullMQ queue → Worker
  → fetch from external API (Reonic, 3CX, Bexio...)
  → validate with Zod
  → upsert into Supabase (service role, explicit tenant_id)
  → update connector.last_synced_at
  → write to connector_sync_log
  → trigger KPI snapshot recompute if new data
```
Each connector is its own BullMQ worker class in `apps/api/src/workers/connectors/`.

---

## 6. Branding System

### Brand Tokens (CSS Custom Properties)
These are the only CSS variables components may use for brand-specific values:

```css
--brand-primary          /* main action color */
--brand-secondary        /* text, headers */
--brand-accent           /* highlights, badges */
--brand-background       /* page background */
--brand-surface          /* card/panel background */
--brand-text-primary     /* body text */
--brand-text-secondary   /* muted text */
--brand-font             /* font family name */
--brand-radius           /* border radius base */
--brand-logo-url         /* injected as data attribute, not CSS var */
```

### Injection Point
```typescript
// apps/web/app/layout.tsx (root layout, server component)
export default async function RootLayout({ children }) {
  const tenant = await getTenantFromSubdomain()
  const brand = tenant?.branding ?? defaultBranding

  const cssVars = buildBrandCSSVars(brand) // returns inline style string

  return (
    <html style={cssVars} data-logo={brand.logoUrl}>
      <body>{children}</body>
    </html>
  )
}
```

### brand.json Schema
When a holding admin uploads a brand package, it must conform to:
```json
{
  "primary": "#1A56DB",
  "secondary": "#1A1A1A",
  "accent": "#F3A917",
  "background": "#FFFFFF",
  "surface": "#F9FAFB",
  "textPrimary": "#111827",
  "textSecondary": "#6B7280",
  "font": "Inter",
  "fontUrl": "https://fonts.googleapis.com/css2?family=Inter",
  "radius": "8px",
  "darkModeEnabled": true
}
```
Validation is performed server-side with a Zod schema on upload. Invalid brand files
are rejected with a descriptive error — the system must not silently fall back to defaults.

---

## 7. Role & Permission System

### Roles (per tenant)
| Role | Key | Scope |
|------|-----|-------|
| Super User | `super_user` | Full tenant admin — manages users, branding, connectors |
| Geschäftsführung | `geschaeftsfuehrung` | All modules, all staff, coaching view |
| Teamleiter | `teamleiter` | Own team's KPIs (setter OR berater), no finance |
| Setter | `setter` | Own calls, own appointments, own KPIs only |
| Berater | `berater` | Own pipeline, own appointments, own KPIs only |
| Innendienst | `innendienst` | Planning, project phases, IA status — no finance, no sales KPIs |
| Bau / Montage | `bau` | Assigned projects, installation dates, materials |
| Buchhaltung | `buchhaltung` | Invoices, cashflow, payments — no sales KPIs |
| Leadkontrolle | `leadkontrolle` | All leads, lead quality, no finance |

### Permission Keys
Format: `module:{module_name}:{action}`

Actions: `read`, `write`, `export`, `admin`
Modules: `setter`, `berater`, `leads`, `innendienst`, `bau`, `finance`, `reports`, `ai`, `admin`

### Permission Check Pattern
```typescript
// Server component / API route
import { hasPermission } from '@/lib/auth'

const canViewFinance = await hasPermission(user, 'module:finance:read')
if (!canViewFinance) redirect('/dashboard')

// Never check permissions in client components — always server-side
```

### Holding Admin
- Holding admins have a special `holding:global` permission.
- They are **not** tenant users. They have no `tenant_id`.
- They access a separate holding dashboard at `admin.platform.com` (no company branding).
- They can impersonate a tenant super user for support purposes (logged in audit trail).

---

## 8. Database Guidelines

### Schema File
The authoritative schema is at `supabase/schema.sql`. It is the reference.
All changes to the database go through numbered migration files in `supabase/migrations/`.
Never modify `schema.sql` directly in production — always write a migration.

### Migration Naming
```
supabase/migrations/
  001_initial_schema.sql
  002_add_call_analysis_scores.sql
  003_add_project_delay_reason.sql
```

### Prisma Schema Sync
The Prisma schema (`apps/api/prisma/schema.prisma`) must stay in sync with Supabase.
After every migration: `pnpm prisma db pull` to regenerate, then commit the updated schema.

### TimescaleDB Tables (Hypertables)
The following tables are TimescaleDB hypertables. Never run `SELECT *` without a
time-bounded `WHERE` clause on these tables:
- `calls` — partition key: `started_at`
- `cashflow_entries` — partition key: `entry_date`
- `calendar_events` — partition key: `starts_at`
- `kpi_snapshots` — partition key: `period_date`
- `audit_log` — partition key: `created_at`

Always bound time queries: `WHERE started_at > NOW() - INTERVAL '30 days'`

### KPI Snapshot Pattern
Dashboard pages must never compute KPIs on the fly from raw tables.
They read from `kpi_snapshots`. The background worker that populates
`kpi_snapshots` runs every 15 minutes via BullMQ.

```typescript
// CORRECT — reads pre-computed snapshot
const snapshot = await supabase
  .from('kpi_snapshots')
  .select('metrics')
  .eq('snapshot_type', 'setter_daily')
  .eq('entity_id', setterId)
  .eq('period_date', today)
  .single()

// WRONG — never do this in a dashboard render path
const calls = await supabase
  .from('calls')
  .select('*')
  .eq('team_member_id', setterId)
  .gte('started_at', startOfDay)
```

---

## 9. BI Modules (Alpen Energie Reference Implementation)

These are the dashboard modules to build, in priority order. Each module has a
defined data source and a set of required KPIs.

### Module 1: Setter Performance
**Sources**: 3CX (calls), Google Calendar (appointments), Reonic (leads)
**KPIs**: calls/day, reach rate, appointments booked, appointment rate, avg call duration, no-show rate
**Special**: KI-based call quality analysis — score 1–10 across 4 dimensions using Claude API

### Module 2: Berater Performance
**Sources**: Reonic (offers, closings), Google Calendar, Bexio (revenue)
**KPIs**: appointments/week, closing rate, offer volume (CHF), deal duration, activities/day, revenue/advisor

### Module 3: Lead Control
**Sources**: Leadnotes (ingestion), Reonic (status)
**KPIs**: new leads/day, unworked leads, avg response time, lead quality rate, lead source breakdown

### Module 4: Innendienst / Planning
**Sources**: Reonic (project status, notes)
**KPIs**: open planning orders, blocked projects, IA status, planning throughput time

### Module 5: Bau & Montage — 27-Phase Kanban
**Sources**: Reonic (phases), Google Calendar (installation dates)
**View**: Kanban board with drag-and-drop, 27 columns, project cards
**KPIs**: projects per phase, avg throughput time (phase 1→27), blocked projects (phase 5)
**Alerts**: projects stalled >X days in a phase (configurable threshold)

### Module 6: Finance & Cashflow
**Sources**: Bexio (invoices, payments), Excel upload (cashflow)
**KPIs**: monthly revenue, open receivables, overdue invoices, weekly payments, 30/60/90-day liquidity forecast
**Special**: Cashflow chart (Excel-sourced), liquidity warning when forecast drops below threshold

### Daily Email Report
Sent every morning (configurable time). Audience: Geschäftsführung + Teamleiter.
Generated by a background job using the Claude API (claude-sonnet-4-6).
Contains: KPI summary, highlights, warnings, per-staff coaching suggestions.
Format: HTML email (React Email template) with optional PDF attachment.
Max reading time: 30 minutes.

---

## 10. External Integrations (Connectors)

### Connector Architecture
Each connector is a class implementing the `ConnectorBase` interface:
```typescript
interface ConnectorBase {
  readonly type: ConnectorType
  validate(config: unknown): Promise<void>
  sync(tenantId: string, connector: Connector): Promise<SyncResult>
}
```

Connectors live in `apps/api/src/workers/connectors/`.
Each has its own Zod schema for validating the raw API response before writing to DB.

### Connectors by Priority
| Priority | Connector | Sync interval | Auth method |
|----------|-----------|--------------|-------------|
| MUST (P1) | Reonic CRM | 15 min | REST API key |
| MUST (P1) | 3CX Cloud | 15 min | REST API + webhook |
| MUST (P1) | Bexio | 1 hour | OAuth 2.0 |
| MUST (P1) | Google Calendar | 15 min | Google OAuth (service account) |
| MUST (P1) | Leadnotes | 15 min | REST API key |
| SHOULD (P2) | WhatsApp Business | 30 min | Cloud API token |
| COULD (P3) | Gmail | 1 hour | Google OAuth |

### API Credentials Storage
Connector credentials (API keys, OAuth tokens) are stored in the `connectors.credentials`
JSONB column. In production, this column must be encrypted using Supabase Vault.
Never log credentials. Never expose them in API responses. Never commit them to git.

### Error Handling
If a sync fails, update `connectors.status = 'error'` and `last_error`.
Retry with exponential backoff (max 3 attempts). Alert holding admin after 3 failures.
The dashboard must show connector health status visibly to super users.

---

## 11. AI Integration (Claude API)

### Use Cases
1. **Call analysis** — transcription + quality scoring of setter calls
2. **Daily report generation** — narrative coaching report from KPI data

### Call Analysis Pipeline
```
3CX recording (audio file)
  → stored in Supabase Storage (EU)
  → transcribed via OpenAI Whisper (Schweizerdeutsch support required)
  → transcript anonymised (strip names/phone numbers before sending to Claude)
  → Claude API: score on 4 dimensions, generate improvement suggestions
  → results written to call_analysis table
```

### Model
Always use `claude-sonnet-4-6` for both use cases.
Max tokens: 2000 for call analysis, 4000 for daily report.

### PII Policy
**Never send the following to the Claude API**:
- Customer names
- Phone numbers
- Addresses
- Any data that can identify an individual customer

Strip PII from transcripts before API calls. Use placeholder tokens: `[CUSTOMER]`, `[PHONE]`.

### Prompt Files
All Claude prompts live in `apps/api/src/ai/prompts/`.
They are versioned text files, not inline strings.
Prompt files:
```
apps/api/src/ai/prompts/
  call-analysis.md          # scoring prompt template
  daily-report.md           # report generation prompt
  call-script-check.md      # script adherence evaluation
```

---

## 12. Testing Strategy

### Test Coverage Requirements
| Layer | Tool | Minimum coverage |
|-------|------|-----------------|
| Shared types/utils | Vitest | 90% |
| API route handlers | Vitest + Supertest | 80% |
| Auth middleware | Vitest | 100% |
| RLS policies | pgTAP (SQL tests) | All policies tested |
| React components | Vitest + Testing Library | Critical paths only |
| E2E | Playwright | Login flow, tenant isolation, role routing |

### Critical E2E Tests (must exist before Supabase go-live)
1. Tenant A user cannot see Tenant B's data
2. User without `must_reset_password = false` is blocked from dashboard
3. User without `totp_enabled = true` is blocked from dashboard
4. Each role can only access its permitted modules
5. Holding admin can see all tenants; cannot be assigned a tenant role

### Test Tenant Isolation
E2E tests must provision two real test tenants in Supabase and verify cross-tenant
data leakage is impossible — not just filtered, but blocked at DB level.

---

## 13. Code Quality Standards

### TypeScript
- `strict: true` in all tsconfig files
- No `any`. Use `unknown` and narrow with Zod.
- All API response types are generated from Zod schemas — not hand-written.
- Database types are generated from Prisma — not hand-written.
- Shared types live in `packages/types` and are imported, not duplicated.

### File & Folder Naming
- Files: `kebab-case.ts`
- React components: `PascalCase.tsx`
- Folders: `kebab-case`
- Constants: `SCREAMING_SNAKE_CASE`
- Zod schemas: `{name}Schema` (e.g. `CreateLeadSchema`)
- Types/interfaces: `PascalCase` (e.g. `Lead`, `TenantBranding`)

### Component Rules
- Server components by default. Add `'use client'` only when required.
- No business logic in components. Components call hooks; hooks call data layer.
- All form validation uses Zod schemas imported from `packages/types`.
- No inline styles. Use Tailwind classes. Brand overrides use CSS custom properties.
- Every interactive element must be keyboard-accessible and have an aria label.

### API Route Rules
- Every route has a Zod schema for request validation.
- Every route returns a consistent envelope: `{ data, error, meta }`.
- HTTP status codes are used correctly. No `200` responses with error bodies.
- All errors are logged with a correlation ID. Never expose stack traces to clients.

### Git Conventions
```
feat: add cashflow upload endpoint
fix: correct RLS policy for innendienst role
chore: update Prisma schema after migration 003
docs: add connector architecture notes
test: add E2E test for tenant isolation
```
Branch naming: `feat/setter-dashboard`, `fix/rls-innendienst`, `chore/prisma-sync`
Never commit directly to `main`. All changes via PR with at least one review.

---

## 14. Environment Variables

### Required — `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, never exposed to client
PLATFORM_ROOT_DOMAIN=platform.com
REDIS_URL=
```

### Required — `apps/api/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                        # Prisma direct connection
DIRECT_URL=                          # Prisma direct (no pooler) for migrations
REDIS_URL=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
ENCRYPTION_KEY=                      # 32-byte hex, for credential encryption
```

### Rules
- Never commit `.env` or `.env.local` files. `.env.example` only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It bypasses RLS.
- `ANTHROPIC_API_KEY` is API-side only. It never touches the web app.

---

## 15. Forbidden Patterns

These patterns must never appear in the codebase:

```typescript
// ❌ Trusting tenant from client input
const tenantId = req.body.tenantId

// ❌ Skipping tenant scope in a query
supabase.from('leads').select('*')  // without .eq('tenant_id', verifiedTenantId)

// ❌ Using service role client for user requests
const supabase = createClient(url, SERVICE_ROLE_KEY)  // in a user-facing route

// ❌ Hardcoded brand colors in components
<div className="bg-blue-600">

// ❌ Inline SQL strings
prisma.$queryRawUnsafe(`SELECT * FROM leads WHERE tenant_id = '${tenantId}'`)

// ❌ Skipping Zod validation on external data
const lead = response.data as Lead  // should be: LeadSchema.parse(response.data)

// ❌ PII in AI prompts
const prompt = `Analyse this call with customer ${customer.name} at ${customer.phone}`

// ❌ Checking permissions client-side only
if (user.role === 'berater') return <FinanceDashboard />  // must be server-side too

// ❌ any type
function processLead(data: any) { ... }
```

---

## 16. Build & Run Commands

```bash
# Install
pnpm install

# Development
pnpm dev                  # starts all apps in parallel
pnpm --filter web dev     # web only
pnpm --filter api dev     # api only

# Database
pnpm supabase start       # local Supabase instance
pnpm supabase db reset    # reset + re-run all migrations + seed
pnpm db:generate          # pnpm prisma generate
pnpm db:migrate           # pnpm prisma migrate dev

# Testing
pnpm test                 # all unit tests
pnpm test:e2e             # Playwright E2E
pnpm test:db              # pgTAP SQL tests against local Supabase

# Build
pnpm build                # build all apps
pnpm typecheck            # tsc --noEmit across all packages
pnpm lint                 # ESLint across all packages
```

---

## 17. What to Build First (Phase Sequence)

When starting a new coding session, follow this sequence strictly.
Do not skip ahead. Each phase produces working, testable software.

### Phase 1 — Foundation (no DB)
- [ ] Monorepo scaffold (pnpm workspaces, tsconfig paths, ESLint/Prettier)
- [ ] `packages/types` — Database types from schema.sql, mock data layer
- [ ] `apps/web` — Next.js with Tailwind, subdomain middleware (mocked tenant)
- [ ] Branding injection — CSS custom property system, brand.json validation
- [ ] Auth pages — login, reset-password, enrol-2fa (UI only, no real auth)

### Phase 2 — Auth & Roles (no DB)
- [ ] Full auth flow against Supabase Auth (login → reset → 2FA → dashboard)
- [ ] Middleware enforcing the three auth gates
- [ ] Role-scoped routing — each role lands on correct module, wrong modules redirect
- [ ] Holding admin portal (separate from tenant dashboards)
- [ ] Super user — user management, role assignment UI

### Phase 3 — Supabase Live
- [ ] Run `schema.sql` on Supabase project (EU region)
- [ ] Configure RLS policies, verify with pgTAP tests
- [ ] Swap mock data layer for real Supabase client
- [ ] E2E tests for tenant isolation (two real test tenants)
- [ ] Holding admin creates tenant → triggers seed roles, branding init

### Phase 4 — First BI Module (Setter Performance)
- [ ] Reonic connector (sync leads, offers, team members)
- [ ] 3CX connector (sync call logs)
- [ ] KPI snapshot worker (runs every 15 min)
- [ ] Setter dashboard — KPIs from kpi_snapshots
- [ ] Daily email report (basic version, no AI yet)

### Phase 5 — Remaining Modules
- [ ] Berater, Leadkontrolle, Innendienst, Finance modules
- [ ] 27-phase Kanban board (Bau & Montage)
- [ ] Bexio + Google Calendar connectors
- [ ] Cashflow Excel upload + parsing

### Phase 6 — AI Features
- [ ] Call transcription pipeline (Whisper → anonymise → store)
- [ ] Claude API call analysis (scoring + suggestions)
- [ ] AI-enhanced daily report (narrative coaching sections)
- [ ] Call script management (super user can update the script the AI checks against)

---

*Last updated: March 2026*
*Platform: Enura Group Multi-Tenant BI*
*Reference tenant: Alpen Energie GmbH*
*Schema version: 1.0 (see supabase/schema.sql)*

Please take into consideration the file called Lastenheft_Alpen_Energie_BI_Dashboard_v1.pdf
