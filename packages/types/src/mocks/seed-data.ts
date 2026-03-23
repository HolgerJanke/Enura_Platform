// =============================================================================
// Enura Platform — Mock Seed Data
// Realistic German/Swiss content for development and testing
// =============================================================================

import type {
  TenantRow,
  TenantBrandingRow,
  ProfileRow,
  RoleRow,
  PermissionRow,
  RolePermissionRow,
  ProfileRoleRow,
  TeamMemberRow,
  LeadRow,
  OfferRow,
  CallRow,
  CallAnalysisRow,
  ProjectRow,
  PhaseDefinitionRow,
  InvoiceRow,
  ConnectorRow,
  KpiSnapshotRow,
} from '../database.js'

// ---------------------------------------------------------------------------
// Constants — Tenant IDs
// ---------------------------------------------------------------------------

export const TENANT_ALPEN_ENERGIE_ID = '00000000-0000-0000-0000-000000000001'
export const TENANT_TEST_COMPANY_ID = '00000000-0000-0000-0000-000000000002'

// ---------------------------------------------------------------------------
// Constants — Holding Admin Profile ID
// ---------------------------------------------------------------------------

export const HOLDING_ADMIN_PROFILE_ID = 'h0000000-0000-0000-0000-000000000001'

// ---------------------------------------------------------------------------
// Helper — deterministic UUID generator for seed data
// ---------------------------------------------------------------------------

function profileId(tenantNum: number, roleIndex: number): string {
  const tn = String(tenantNum).padStart(2, '0')
  const ri = String(roleIndex).padStart(2, '0')
  return `p${tn}00000-0000-0000-0000-0000000000${ri}`
}

function roleId(tenantNum: number, roleIndex: number): string {
  const tn = String(tenantNum).padStart(2, '0')
  const ri = String(roleIndex).padStart(2, '0')
  return `r${tn}00000-0000-0000-0000-0000000000${ri}`
}

function permId(index: number): string {
  const pi = String(index).padStart(3, '0')
  return `perm0000-0000-0000-0000-000000000${pi}`
}

function rpId(index: number): string {
  const i = String(index).padStart(4, '0')
  return `rp000000-0000-0000-0000-00000000${i}`
}

function prId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `pr000000-0000-0000-0000-000000000${i}`
}

function teamMemberId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `tm000000-0000-0000-0000-000000000${i}`
}

function leadId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `lead0000-0000-0000-0000-000000000${i}`
}

function offerId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `offer000-0000-0000-0000-000000000${i}`
}

function callId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `call0000-0000-0000-0000-000000000${i}`
}

function projectId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `proj0000-0000-0000-0000-000000000${i}`
}

function phaseDefId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `phase000-0000-0000-0000-000000000${i}`
}

function invoiceId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `inv00000-0000-0000-0000-000000000${i}`
}

function connectorId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `conn0000-0000-0000-0000-000000000${i}`
}

function brandingId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `brand000-0000-0000-0000-000000000${i}`
}

function callAnalysisId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `ca000000-0000-0000-0000-000000000${i}`
}

function kpiSnapshotId(index: number): string {
  const i = String(index).padStart(3, '0')
  return `kpi00000-0000-0000-0000-000000000${i}`
}

const NOW = '2026-03-23T10:00:00.000Z'
const YESTERDAY = '2026-03-22T10:00:00.000Z'

// ---------------------------------------------------------------------------
// TENANTS
// ---------------------------------------------------------------------------

export const tenants: TenantRow[] = [
  {
    id: TENANT_ALPEN_ENERGIE_ID,
    slug: 'alpen-energie',
    name: 'Alpen Energie GmbH',
    status: 'active',
    created_by: HOLDING_ADMIN_PROFILE_ID,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  },
  {
    id: TENANT_TEST_COMPANY_ID,
    slug: 'test-company',
    name: 'Test Company AG',
    status: 'active',
    created_by: HOLDING_ADMIN_PROFILE_ID,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-02-01T08:00:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// TENANT BRANDINGS
// ---------------------------------------------------------------------------

export const tenantBrandings: TenantBrandingRow[] = [
  {
    id: brandingId(1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    primary_color: '#1A56DB',
    secondary_color: '#1A1A1A',
    accent_color: '#F3A917',
    background_color: '#FFFFFF',
    surface_color: '#F9FAFB',
    text_primary: '#111827',
    text_secondary: '#6B7280',
    font_family: 'Inter',
    font_url: 'https://fonts.googleapis.com/css2?family=Inter',
    border_radius: '8px',
    logo_url: '/assets/logos/alpen-energie.svg',
    dark_mode_enabled: true,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  },
  {
    id: brandingId(2),
    tenant_id: TENANT_TEST_COMPANY_ID,
    primary_color: '#059669',
    secondary_color: '#1A1A1A',
    accent_color: '#D97706',
    background_color: '#FFFFFF',
    surface_color: '#F0FDF4',
    text_primary: '#111827',
    text_secondary: '#6B7280',
    font_family: 'Source Sans Pro',
    font_url: 'https://fonts.googleapis.com/css2?family=Source+Sans+Pro',
    border_radius: '6px',
    logo_url: '/assets/logos/test-company.svg',
    dark_mode_enabled: false,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-02-01T08:00:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// ROLE DEFINITIONS
// ---------------------------------------------------------------------------

const roleKeys = [
  { key: 'super_user', label: 'Super User', desc: 'Voller Tenant-Administrator' },
  { key: 'geschaeftsfuehrung', label: 'Gesch\u00e4ftsf\u00fchrung', desc: 'Alle Module, alle Mitarbeiter, Coaching-Ansicht' },
  { key: 'teamleiter', label: 'Teamleiter', desc: 'Team-KPIs (Setter oder Berater), kein Finanzbereich' },
  { key: 'setter', label: 'Setter', desc: 'Eigene Anrufe, eigene Termine, eigene KPIs' },
  { key: 'berater', label: 'Berater', desc: 'Eigene Pipeline, eigene Termine, eigene KPIs' },
  { key: 'innendienst', label: 'Innendienst', desc: 'Planung, Projektphasen, IA-Status' },
  { key: 'bau', label: 'Bau / Montage', desc: 'Zugewiesene Projekte, Installationsdaten, Materialien' },
  { key: 'buchhaltung', label: 'Buchhaltung', desc: 'Rechnungen, Cashflow, Zahlungen' },
  { key: 'leadkontrolle', label: 'Leadkontrolle', desc: 'Alle Leads, Lead-Qualit\u00e4t' },
] as const

export const roles: RoleRow[] = [
  // Holding admin role (no tenant_id)
  {
    id: roleId(0, 0),
    tenant_id: null,
    key: 'holding_admin',
    label: 'Holding Admin',
    description: 'Globaler Administrator der Holding',
    is_system: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  // Tenant 1 roles (alpen-energie)
  ...roleKeys.map((rk, i) => ({
    id: roleId(1, i + 1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    key: rk.key,
    label: rk.label,
    description: rk.desc,
    is_system: true,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  })),
  // Tenant 2 roles (test-company)
  ...roleKeys.map((rk, i) => ({
    id: roleId(2, i + 1),
    tenant_id: TENANT_TEST_COMPANY_ID,
    key: rk.key,
    label: rk.label,
    description: rk.desc,
    is_system: true,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-02-01T08:00:00.000Z',
  })),
]

// ---------------------------------------------------------------------------
// PERMISSIONS
// ---------------------------------------------------------------------------

const permissionDefs: Array<{ key: string; label: string; description: string }> = [
  // Holding
  { key: 'holding:global', label: 'Holding Global', description: 'Voller Zugriff auf alle Tenants' },
  // Setter module
  { key: 'module:setter:read', label: 'Setter lesen', description: 'Setter-Dashboard anzeigen' },
  { key: 'module:setter:write', label: 'Setter schreiben', description: 'Setter-Daten bearbeiten' },
  { key: 'module:setter:export', label: 'Setter exportieren', description: 'Setter-Daten exportieren' },
  { key: 'module:setter:admin', label: 'Setter administrieren', description: 'Setter-Modul verwalten' },
  // Berater module
  { key: 'module:berater:read', label: 'Berater lesen', description: 'Berater-Dashboard anzeigen' },
  { key: 'module:berater:write', label: 'Berater schreiben', description: 'Berater-Daten bearbeiten' },
  { key: 'module:berater:export', label: 'Berater exportieren', description: 'Berater-Daten exportieren' },
  { key: 'module:berater:admin', label: 'Berater administrieren', description: 'Berater-Modul verwalten' },
  // Leads module
  { key: 'module:leads:read', label: 'Leads lesen', description: 'Lead-Dashboard anzeigen' },
  { key: 'module:leads:write', label: 'Leads schreiben', description: 'Lead-Daten bearbeiten' },
  { key: 'module:leads:export', label: 'Leads exportieren', description: 'Lead-Daten exportieren' },
  { key: 'module:leads:admin', label: 'Leads administrieren', description: 'Lead-Modul verwalten' },
  // Innendienst module
  { key: 'module:innendienst:read', label: 'Innendienst lesen', description: 'Innendienst-Dashboard anzeigen' },
  { key: 'module:innendienst:write', label: 'Innendienst schreiben', description: 'Innendienst-Daten bearbeiten' },
  { key: 'module:innendienst:export', label: 'Innendienst exportieren', description: 'Innendienst-Daten exportieren' },
  { key: 'module:innendienst:admin', label: 'Innendienst administrieren', description: 'Innendienst-Modul verwalten' },
  // Bau module
  { key: 'module:bau:read', label: 'Bau lesen', description: 'Bau-Dashboard anzeigen' },
  { key: 'module:bau:write', label: 'Bau schreiben', description: 'Bau-Daten bearbeiten' },
  { key: 'module:bau:export', label: 'Bau exportieren', description: 'Bau-Daten exportieren' },
  { key: 'module:bau:admin', label: 'Bau administrieren', description: 'Bau-Modul verwalten' },
  // Finance module
  { key: 'module:finance:read', label: 'Finanzen lesen', description: 'Finanz-Dashboard anzeigen' },
  { key: 'module:finance:write', label: 'Finanzen schreiben', description: 'Finanzdaten bearbeiten' },
  { key: 'module:finance:export', label: 'Finanzen exportieren', description: 'Finanzdaten exportieren' },
  { key: 'module:finance:admin', label: 'Finanzen administrieren', description: 'Finanz-Modul verwalten' },
  // Reports module
  { key: 'module:reports:read', label: 'Berichte lesen', description: 'Berichte anzeigen' },
  { key: 'module:reports:write', label: 'Berichte schreiben', description: 'Berichte erstellen' },
  { key: 'module:reports:export', label: 'Berichte exportieren', description: 'Berichte exportieren' },
  { key: 'module:reports:admin', label: 'Berichte administrieren', description: 'Berichts-Modul verwalten' },
  // AI module
  { key: 'module:ai:read', label: 'KI lesen', description: 'KI-Analysen anzeigen' },
  { key: 'module:ai:write', label: 'KI schreiben', description: 'KI-Analysen ausl\u00f6sen' },
  { key: 'module:ai:admin', label: 'KI administrieren', description: 'KI-Modul verwalten' },
  // Admin module
  { key: 'module:admin:read', label: 'Admin lesen', description: 'Admin-Bereich anzeigen' },
  { key: 'module:admin:write', label: 'Admin schreiben', description: 'Admin-Einstellungen bearbeiten' },
  { key: 'module:admin:branding', label: 'Branding verwalten', description: 'Tenant-Branding anpassen' },
  { key: 'module:admin:users', label: 'Benutzer verwalten', description: 'Benutzer anlegen und verwalten' },
  { key: 'module:admin:connectors', label: 'Konnektoren verwalten', description: 'Konnektoren konfigurieren' },
]

export const permissions: PermissionRow[] = permissionDefs.map((pd, i) => ({
  id: permId(i + 1),
  key: pd.key,
  label: pd.label,
  description: pd.description,
  created_at: '2026-01-01T00:00:00.000Z',
}))

// ---------------------------------------------------------------------------
// Helper — permission lookup by key
// ---------------------------------------------------------------------------

function getPermId(key: string): string {
  const perm = permissions.find((p) => p.key === key)
  if (!perm) throw new Error(`Permission not found: ${key}`)
  return perm.id
}

// ---------------------------------------------------------------------------
// ROLE → PERMISSION MAPPING
// ---------------------------------------------------------------------------

// Define which permissions each role key gets
const rolePermMap: Record<string, string[]> = {
  holding_admin: ['holding:global'],
  super_user: [
    'module:setter:read', 'module:setter:write', 'module:setter:export', 'module:setter:admin',
    'module:berater:read', 'module:berater:write', 'module:berater:export', 'module:berater:admin',
    'module:leads:read', 'module:leads:write', 'module:leads:export', 'module:leads:admin',
    'module:innendienst:read', 'module:innendienst:write', 'module:innendienst:export', 'module:innendienst:admin',
    'module:bau:read', 'module:bau:write', 'module:bau:export', 'module:bau:admin',
    'module:finance:read', 'module:finance:write', 'module:finance:export', 'module:finance:admin',
    'module:reports:read', 'module:reports:write', 'module:reports:export', 'module:reports:admin',
    'module:ai:read', 'module:ai:write', 'module:ai:admin',
    'module:admin:read', 'module:admin:write', 'module:admin:branding', 'module:admin:users', 'module:admin:connectors',
  ],
  geschaeftsfuehrung: [
    'module:setter:read', 'module:setter:export',
    'module:berater:read', 'module:berater:export',
    'module:leads:read', 'module:leads:export',
    'module:innendienst:read', 'module:innendienst:export',
    'module:bau:read', 'module:bau:export',
    'module:finance:read', 'module:finance:export',
    'module:reports:read', 'module:reports:write', 'module:reports:export',
    'module:ai:read',
  ],
  teamleiter: [
    'module:setter:read', 'module:setter:export',
    'module:berater:read', 'module:berater:export',
    'module:leads:read',
    'module:reports:read',
    'module:ai:read',
  ],
  setter: [
    'module:setter:read',
    'module:leads:read',
  ],
  berater: [
    'module:berater:read',
    'module:leads:read',
  ],
  innendienst: [
    'module:innendienst:read', 'module:innendienst:write',
    'module:bau:read',
    'module:leads:read',
  ],
  bau: [
    'module:bau:read', 'module:bau:write',
  ],
  buchhaltung: [
    'module:finance:read', 'module:finance:write', 'module:finance:export',
  ],
  leadkontrolle: [
    'module:leads:read', 'module:leads:write', 'module:leads:export',
  ],
}

// Build role_permissions rows
let rpCounter = 0

function buildRolePermissions(targetRoles: RoleRow[]): RolePermissionRow[] {
  const result: RolePermissionRow[] = []
  for (const role of targetRoles) {
    const permKeys = rolePermMap[role.key]
    if (!permKeys) continue
    for (const pk of permKeys) {
      rpCounter++
      result.push({
        id: rpId(rpCounter),
        role_id: role.id,
        permission_id: getPermId(pk),
        created_at: '2026-01-15T08:00:00.000Z',
      })
    }
  }
  return result
}

export const rolePermissions: RolePermissionRow[] = buildRolePermissions(roles)

// ---------------------------------------------------------------------------
// PROFILES
// ---------------------------------------------------------------------------

// Tenant 1 profile names (alpen-energie)
const t1Names: Array<{ first: string; last: string; email: string; phone: string; roleKey: string }> = [
  { first: 'Thomas', last: 'Brunner', email: 'thomas.brunner@alpen-energie.ch', phone: '+41 79 100 0001', roleKey: 'super_user' },
  { first: 'Hans', last: 'M\u00fcller', email: 'hans.mueller@alpen-energie.ch', phone: '+41 79 100 0002', roleKey: 'geschaeftsfuehrung' },
  { first: 'Petra', last: 'Schneider', email: 'petra.schneider@alpen-energie.ch', phone: '+41 79 100 0003', roleKey: 'teamleiter' },
  { first: 'Marco', last: 'Bernasconi', email: 'marco.bernasconi@alpen-energie.ch', phone: '+41 79 100 0004', roleKey: 'setter' },
  { first: 'Sarah', last: 'Keller', email: 'sarah.keller@alpen-energie.ch', phone: '+41 79 100 0005', roleKey: 'berater' },
  { first: 'Ursula', last: 'Widmer', email: 'ursula.widmer@alpen-energie.ch', phone: '+41 79 100 0006', roleKey: 'innendienst' },
  { first: 'Beat', last: 'Zimmermann', email: 'beat.zimmermann@alpen-energie.ch', phone: '+41 79 100 0007', roleKey: 'bau' },
  { first: 'Claudia', last: 'Meier', email: 'claudia.meier@alpen-energie.ch', phone: '+41 79 100 0008', roleKey: 'buchhaltung' },
  { first: 'Lukas', last: 'Steiner', email: 'lukas.steiner@alpen-energie.ch', phone: '+41 79 100 0009', roleKey: 'leadkontrolle' },
]

// Tenant 2 profile names (test-company)
const t2Names: Array<{ first: string; last: string; email: string; phone: string; roleKey: string }> = [
  { first: 'Andreas', last: 'Weber', email: 'andreas.weber@test-company.ch', phone: '+41 79 200 0001', roleKey: 'super_user' },
  { first: 'Monika', last: 'Fischer', email: 'monika.fischer@test-company.ch', phone: '+41 79 200 0002', roleKey: 'geschaeftsfuehrung' },
  { first: 'Daniel', last: 'Huber', email: 'daniel.huber@test-company.ch', phone: '+41 79 200 0003', roleKey: 'teamleiter' },
  { first: 'Nina', last: 'Schmid', email: 'nina.schmid@test-company.ch', phone: '+41 79 200 0004', roleKey: 'setter' },
  { first: 'Patrick', last: 'Gerber', email: 'patrick.gerber@test-company.ch', phone: '+41 79 200 0005', roleKey: 'berater' },
  { first: 'Karin', last: 'Baumgartner', email: 'karin.baumgartner@test-company.ch', phone: '+41 79 200 0006', roleKey: 'innendienst' },
  { first: 'Reto', last: 'Frei', email: 'reto.frei@test-company.ch', phone: '+41 79 200 0007', roleKey: 'bau' },
  { first: 'Sandra', last: 'Wyss', email: 'sandra.wyss@test-company.ch', phone: '+41 79 200 0008', roleKey: 'buchhaltung' },
  { first: 'Markus', last: 'Baumann', email: 'markus.baumann@test-company.ch', phone: '+41 79 200 0009', roleKey: 'leadkontrolle' },
]

function buildProfiles(
  tenantId: string | null,
  tenantNum: number,
  names: Array<{ first: string; last: string; email: string; phone: string; roleKey: string }>,
): ProfileRow[] {
  return names.map((n, i) => {
    const idx = i + 1
    const isSuperOrAdmin = n.roleKey === 'super_user'
    return {
      id: profileId(tenantNum, idx),
      tenant_id: tenantId,
      first_name: n.first,
      last_name: n.last,
      display_name: `${n.first} ${n.last}`,
      avatar_url: null,
      phone: n.phone,
      locale: 'de-CH',
      must_reset_password: !isSuperOrAdmin,
      password_reset_at: isSuperOrAdmin ? '2026-01-20T09:00:00.000Z' : null,
      totp_enabled: isSuperOrAdmin,
      totp_enrolled_at: isSuperOrAdmin ? '2026-01-20T09:05:00.000Z' : null,
      last_sign_in_at: isSuperOrAdmin ? YESTERDAY : null,
      is_active: true,
      created_at: '2026-01-15T08:00:00.000Z',
      updated_at: '2026-01-15T08:00:00.000Z',
    }
  })
}

export const profiles: ProfileRow[] = [
  // Holding admin profile
  {
    id: HOLDING_ADMIN_PROFILE_ID,
    tenant_id: null,
    first_name: 'Stefan',
    last_name: 'Enura',
    display_name: 'Stefan Enura',
    avatar_url: null,
    phone: '+41 79 000 0001',
    locale: 'de-CH',
    must_reset_password: false,
    password_reset_at: '2026-01-10T09:00:00.000Z',
    totp_enabled: true,
    totp_enrolled_at: '2026-01-10T09:05:00.000Z',
    last_sign_in_at: YESTERDAY,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  // Tenant 1 (alpen-energie)
  ...buildProfiles(TENANT_ALPEN_ENERGIE_ID, 1, t1Names),
  // Tenant 2 (test-company)
  ...buildProfiles(TENANT_TEST_COMPANY_ID, 2, t2Names),
]

// ---------------------------------------------------------------------------
// PROFILE → ROLE MAPPING
// ---------------------------------------------------------------------------

let prCounter = 0

function buildProfileRoles(): ProfileRoleRow[] {
  const result: ProfileRoleRow[] = []

  // Holding admin
  prCounter++
  result.push({
    id: prId(prCounter),
    profile_id: HOLDING_ADMIN_PROFILE_ID,
    role_id: roleId(0, 0), // holding_admin role
    created_at: '2026-01-01T00:00:00.000Z',
  })

  // Tenant 1 profiles → Tenant 1 roles
  for (let i = 0; i < t1Names.length; i++) {
    prCounter++
    const roleIdx = i + 1 // roleKeys index is 0-based, roleId uses i+1
    result.push({
      id: prId(prCounter),
      profile_id: profileId(1, i + 1),
      role_id: roleId(1, roleIdx),
      created_at: '2026-01-15T08:00:00.000Z',
    })
  }

  // Tenant 2 profiles → Tenant 2 roles
  for (let i = 0; i < t2Names.length; i++) {
    prCounter++
    const roleIdx = i + 1
    result.push({
      id: prId(prCounter),
      profile_id: profileId(2, i + 1),
      role_id: roleId(2, roleIdx),
      created_at: '2026-02-01T08:00:00.000Z',
    })
  }

  return result
}

export const profileRoles: ProfileRoleRow[] = buildProfileRoles()

// ---------------------------------------------------------------------------
// TEAM MEMBERS (alpen-energie) — setters and beraters
// ---------------------------------------------------------------------------

export const teamMembers: TeamMemberRow[] = [
  // Setters
  {
    id: teamMemberId(1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    profile_id: profileId(1, 4), // Marco Bernasconi (setter)
    external_id: 'reonic-setter-001',
    first_name: 'Marco',
    last_name: 'Bernasconi',
    display_name: 'Marco Bernasconi',
    email: 'marco.bernasconi@alpen-energie.ch',
    phone: '+41 79 100 0004',
    role_type: 'setter',
    team: 'Setter Team A',
    is_active: true,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  },
  {
    id: teamMemberId(2),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    profile_id: null,
    external_id: 'reonic-setter-002',
    first_name: 'Fabio',
    last_name: 'Rossi',
    display_name: 'Fabio Rossi',
    email: 'fabio.rossi@alpen-energie.ch',
    phone: '+41 79 100 0010',
    role_type: 'setter',
    team: 'Setter Team A',
    is_active: true,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  },
  {
    id: teamMemberId(3),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    profile_id: null,
    external_id: 'reonic-setter-003',
    first_name: 'Anja',
    last_name: 'Lehmann',
    display_name: 'Anja Lehmann',
    email: 'anja.lehmann@alpen-energie.ch',
    phone: '+41 79 100 0011',
    role_type: 'setter',
    team: 'Setter Team B',
    is_active: true,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-02-01T08:00:00.000Z',
  },
  // Beraters
  {
    id: teamMemberId(4),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    profile_id: profileId(1, 5), // Sarah Keller (berater)
    external_id: 'reonic-berater-001',
    first_name: 'Sarah',
    last_name: 'Keller',
    display_name: 'Sarah Keller',
    email: 'sarah.keller@alpen-energie.ch',
    phone: '+41 79 100 0005',
    role_type: 'berater',
    team: 'Berater Team',
    is_active: true,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  },
  {
    id: teamMemberId(5),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    profile_id: null,
    external_id: 'reonic-berater-002',
    first_name: 'David',
    last_name: 'M\u00fcller',
    display_name: 'David M\u00fcller',
    email: 'david.mueller@alpen-energie.ch',
    phone: '+41 79 100 0012',
    role_type: 'berater',
    team: 'Berater Team',
    is_active: true,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-01-15T08:00:00.000Z',
  },
  {
    id: teamMemberId(6),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    profile_id: null,
    external_id: 'reonic-berater-003',
    first_name: 'Laura',
    last_name: 'Ammann',
    display_name: 'Laura Ammann',
    email: 'laura.ammann@alpen-energie.ch',
    phone: '+41 79 100 0013',
    role_type: 'berater',
    team: 'Berater Team',
    is_active: true,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-02-01T08:00:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// LEADS (alpen-energie) — 20 leads
// ---------------------------------------------------------------------------

const leadData: Array<{
  first: string; last: string; email: string; phone: string
  street: string; zip: string; city: string; canton: string
  status: LeadRow['status']; source: LeadRow['source']
  setterId: string | null; notes: string | null
}> = [
  { first: 'Werner', last: 'Hofmann', email: 'w.hofmann@bluewin.ch', phone: '+41 79 300 0001', street: 'Bahnhofstrasse 12', zip: '8001', city: 'Z\u00fcrich', canton: 'ZH', status: 'new', source: 'website', setterId: null, notes: 'Interesse an PV-Anlage f\u00fcr Einfamilienhaus' },
  { first: 'Maria', last: 'Bianchi', email: 'm.bianchi@gmail.com', phone: '+41 79 300 0002', street: 'Kramgasse 8', zip: '3011', city: 'Bern', canton: 'BE', status: 'contacted', source: 'referral', setterId: teamMemberId(1), notes: 'R\u00fcckruf vereinbart f\u00fcr 25.03.' },
  { first: 'Peter', last: 'Wenger', email: 'p.wenger@sunrise.ch', phone: '+41 79 300 0003', street: 'Freie Strasse 45', zip: '4001', city: 'Basel', canton: 'BS', status: 'qualified', source: 'advertising', setterId: teamMemberId(1), notes: 'W\u00e4rmepumpe + PV Kombiangebot gew\u00fcnscht' },
  { first: 'Anna', last: 'R\u00fcttimann', email: 'a.ruettimann@gmx.ch', phone: '+41 79 300 0004', street: 'Pilatusstrasse 22', zip: '6003', city: 'Luzern', canton: 'LU', status: 'appointment_set', source: 'website', setterId: teamMemberId(2), notes: 'Beratungstermin am 28.03. um 14:00' },
  { first: 'Christian', last: 'Zurbr\u00fcgg', email: 'c.zurbruegg@bluewin.ch', phone: '+41 79 300 0005', street: 'Marktgasse 3', zip: '3400', city: 'Burgdorf', canton: 'BE', status: 'won', source: 'partner', setterId: teamMemberId(1), notes: 'Auftrag erteilt: 12 kWp PV + Speicher' },
  { first: 'Elisabeth', last: 'Gerber', email: 'e.gerber@hispeed.ch', phone: '+41 79 300 0006', street: 'Kirchweg 15', zip: '5000', city: 'Aarau', canton: 'AG', status: 'lost', source: 'cold_call', setterId: teamMemberId(2), notes: 'Entschieden sich f\u00fcr Konkurrenzangebot' },
  { first: 'Rudolf', last: 'Aebi', email: 'r.aebi@protonmail.com', phone: '+41 79 300 0007', street: 'Dorfstrasse 67', zip: '3600', city: 'Thun', canton: 'BE', status: 'new', source: 'leadnotes', setterId: null, notes: null },
  { first: 'Franziska', last: 'Stocker', email: 'f.stocker@yahoo.com', phone: '+41 79 300 0008', street: 'Seestrasse 11', zip: '6300', city: 'Zug', canton: 'ZG', status: 'contacted', source: 'website', setterId: teamMemberId(3), notes: 'Erstkontakt per Telefon, sehr interessiert' },
  { first: 'Martin', last: 'Bosshard', email: 'm.bosshard@gmail.com', phone: '+41 79 300 0009', street: 'R\u00f6merstrasse 99', zip: '8400', city: 'Winterthur', canton: 'ZH', status: 'qualified', source: 'referral', setterId: teamMemberId(1), notes: 'Nachbar ist bestehender Kunde, gute Referenz' },
  { first: 'Brigitte', last: 'Kaufmann', email: 'b.kaufmann@bluewin.ch', phone: '+41 79 300 0010', street: 'Hauptstrasse 5', zip: '4500', city: 'Solothurn', canton: 'SO', status: 'appointment_set', source: 'advertising', setterId: teamMemberId(2), notes: 'Termin 30.03. 10:00, Flachdach-PV' },
  { first: 'Urs', last: 'Grunder', email: 'u.grunder@sunrise.ch', phone: '+41 79 300 0011', street: 'Industriestrasse 33', zip: '2500', city: 'Biel/Bienne', canton: 'BE', status: 'won', source: 'website', setterId: teamMemberId(3), notes: 'W\u00e4rmepumpe Luft/Wasser bestellt' },
  { first: 'Heidi', last: 'Leuthold', email: 'h.leuthold@gmx.ch', phone: '+41 79 300 0012', street: 'Sonnenbergstrasse 7', zip: '9000', city: 'St. Gallen', canton: 'SG', status: 'invalid', source: 'other', setterId: null, notes: 'Keine g\u00fcltige Adresse, Mietwohnung' },
  { first: 'J\u00f6rg', last: 'Bieri', email: 'j.bieri@protonmail.com', phone: '+41 79 300 0013', street: 'Bundesplatz 1', zip: '3003', city: 'Bern', canton: 'BE', status: 'new', source: 'website', setterId: null, notes: 'Anfrage \u00fcber Kontaktformular' },
  { first: 'Silvia', last: 'Sutter', email: 's.sutter@gmail.com', phone: '+41 79 300 0014', street: 'Grabenstrasse 21', zip: '6004', city: 'Luzern', canton: 'LU', status: 'contacted', source: 'partner', setterId: teamMemberId(1), notes: 'Partner-Lead von Elektro Moser' },
  { first: 'Marcel', last: 'Egger', email: 'm.egger@hispeed.ch', phone: '+41 79 300 0015', street: 'Talstrasse 55', zip: '8002', city: 'Z\u00fcrich', canton: 'ZH', status: 'qualified', source: 'advertising', setterId: teamMemberId(2), notes: 'Grosses Dach, 20+ kWp m\u00f6glich' },
  { first: 'Barbara', last: 'Blaser', email: 'b.blaser@bluewin.ch', phone: '+41 79 300 0016', street: 'Wiesenweg 4', zip: '3007', city: 'Bern', canton: 'BE', status: 'new', source: 'leadnotes', setterId: null, notes: null },
  { first: 'Felix', last: 'Kn\u00f6pfel', email: 'f.knoepfel@yahoo.com', phone: '+41 79 300 0017', street: 'Bergstrasse 78', zip: '5400', city: 'Baden', canton: 'AG', status: 'appointment_set', source: 'website', setterId: teamMemberId(3), notes: 'Berater-Termin 01.04. 09:00' },
  { first: 'Rita', last: 'Amstutz', email: 'r.amstutz@protonmail.com', phone: '+41 79 300 0018', street: 'Mattenstrasse 18', zip: '3800', city: 'Interlaken', canton: 'BE', status: 'won', source: 'referral', setterId: teamMemberId(1), notes: 'PV 15 kWp + Wallbox, Vertrag unterschrieben' },
  { first: 'Heinz', last: 'Liechti', email: 'h.liechti@gmail.com', phone: '+41 79 300 0019', street: 'Oberdorfstrasse 9', zip: '8200', city: 'Schaffhausen', canton: 'SH', status: 'lost', source: 'cold_call', setterId: teamMemberId(2), notes: 'Budget reicht nicht, evtl. n\u00e4chstes Jahr' },
  { first: 'Doris', last: 'Fl\u00fcckiger', email: 'd.flueckiger@sunrise.ch', phone: '+41 79 300 0020', street: 'Laupenstrasse 42', zip: '3008', city: 'Bern', canton: 'BE', status: 'contacted', source: 'website', setterId: teamMemberId(3), notes: 'Interessiert an W\u00e4rmepumpe, bestehende \u00d6lheizung' },
]

export const leads: LeadRow[] = leadData.map((ld, i) => ({
  id: leadId(i + 1),
  tenant_id: TENANT_ALPEN_ENERGIE_ID,
  external_id: `reonic-lead-${String(i + 1).padStart(3, '0')}`,
  first_name: ld.first,
  last_name: ld.last,
  email: ld.email,
  phone: ld.phone,
  address_street: ld.street,
  address_zip: ld.zip,
  address_city: ld.city,
  address_canton: ld.canton,
  status: ld.status,
  source: ld.source,
  setter_id: ld.setterId,
  notes: ld.notes,
  qualified_at: ld.status === 'qualified' || ld.status === 'appointment_set' || ld.status === 'won'
    ? '2026-03-20T10:00:00.000Z'
    : null,
  created_at: `2026-03-${String(Math.max(1, i + 3)).padStart(2, '0')}T08:00:00.000Z`,
  updated_at: `2026-03-${String(Math.min(23, i + 5)).padStart(2, '0')}T14:00:00.000Z`,
}))

// ---------------------------------------------------------------------------
// OFFERS (alpen-energie) — 10 offers
// ---------------------------------------------------------------------------

const offerData: Array<{
  title: string; desc: string; amount: string; status: OfferRow['status']
  leadIdx: number; beraterIdx: number
}> = [
  { title: 'PV-Anlage 12 kWp mit Speicher', desc: 'Photovoltaikanlage 12 kWp mit 10 kWh Speicher, Indach-Montage', amount: '42500.00', status: 'won', leadIdx: 5, beraterIdx: 4 },
  { title: 'W\u00e4rmepumpe Luft/Wasser COP 4.5', desc: 'Luft/Wasser-W\u00e4rmepumpe inkl. Demontage \u00d6lheizung', amount: '35000.00', status: 'won', leadIdx: 11, beraterIdx: 5 },
  { title: 'PV 15 kWp + Wallbox 22kW', desc: 'Aufdach-PV 15 kWp mit Wallbox und Smart Energy Management', amount: '58000.00', status: 'won', leadIdx: 18, beraterIdx: 4 },
  { title: 'PV + W\u00e4rmepumpe Kombipaket', desc: 'Komplettl\u00f6sung: 10 kWp PV + W\u00e4rmepumpe + Boiler', amount: '72000.00', status: 'sent', leadIdx: 3, beraterIdx: 5 },
  { title: 'PV-Anlage 8 kWp Flachdach', desc: 'Flachdach-PV mit Ost/West-Aufst\u00e4nderung', amount: '28500.00', status: 'sent', leadIdx: 10, beraterIdx: 6 },
  { title: 'PV 20 kWp Gewerbedach', desc: 'Grosse PV-Anlage f\u00fcr Gewerbedach, inkl. Monitoring', amount: '85000.00', status: 'negotiating', leadIdx: 15, beraterIdx: 4 },
  { title: 'W\u00e4rmepumpe Erdw\u00e4rme', desc: 'Erdsondenbohrung 2x120m + Sole/Wasser-WP', amount: '65000.00', status: 'draft', leadIdx: 17, beraterIdx: 5 },
  { title: 'PV 6 kWp Starter-Paket', desc: 'Kompakte PV f\u00fcr kleines Dach, 6 kWp ohne Speicher', amount: '18500.00', status: 'expired', leadIdx: 6, beraterIdx: 6 },
  { title: 'Speichernachr\u00fcstung 15 kWh', desc: 'Nachr\u00fcstung Batteriespeicher 15 kWh zu bestehender PV', amount: '15000.00', status: 'lost', leadIdx: 19, beraterIdx: 4 },
  { title: 'PV 10 kWp mit Optimierern', desc: 'PV-Anlage mit Leistungsoptimierern f\u00fcr teilverschattetes Dach', amount: '38000.00', status: 'sent', leadIdx: 9, beraterIdx: 5 },
]

export const offers: OfferRow[] = offerData.map((od, i) => ({
  id: offerId(i + 1),
  tenant_id: TENANT_ALPEN_ENERGIE_ID,
  external_id: `reonic-offer-${String(i + 1).padStart(3, '0')}`,
  lead_id: leadId(od.leadIdx),
  berater_id: teamMemberId(od.beraterIdx),
  title: od.title,
  description: od.desc,
  amount_chf: od.amount,
  status: od.status,
  sent_at: od.status !== 'draft' ? '2026-03-15T10:00:00.000Z' : null,
  decided_at: od.status === 'won' || od.status === 'lost' ? '2026-03-20T14:00:00.000Z' : null,
  valid_until: '2026-04-30',
  created_at: `2026-03-${String(10 + i).padStart(2, '0')}T09:00:00.000Z`,
  updated_at: `2026-03-${String(Math.min(23, 15 + i)).padStart(2, '0')}T16:00:00.000Z`,
}))

// ---------------------------------------------------------------------------
// CALLS (alpen-energie) — 30 calls
// ---------------------------------------------------------------------------

const callStatuses: CallRow['status'][] = [
  'answered', 'answered', 'answered', 'missed', 'answered',
  'answered', 'missed', 'answered', 'answered', 'voicemail',
  'answered', 'answered', 'missed', 'answered', 'answered',
  'busy', 'answered', 'answered', 'answered', 'missed',
  'answered', 'answered', 'answered', 'voicemail', 'answered',
  'answered', 'missed', 'answered', 'failed', 'answered',
]

const callDurations = [
  245, 180, 320, 0, 410, 90, 0, 278, 195, 45,
  520, 360, 0, 145, 480, 0, 210, 305, 175, 0,
  430, 265, 390, 30, 155, 600, 0, 340, 0, 225,
]

const callerNumbers = [
  '+41 79 300 0001', '+41 79 300 0002', '+41 79 300 0003', '+41 79 300 0004',
  '+41 79 300 0005', '+41 79 300 0006', '+41 79 300 0007', '+41 79 300 0008',
  '+41 79 300 0009', '+41 79 300 0010', '+41 79 300 0011', '+41 79 300 0012',
  '+41 79 300 0013', '+41 79 300 0014', '+41 79 300 0015', '+41 79 300 0016',
  '+41 79 300 0017', '+41 79 300 0018', '+41 79 300 0019', '+41 79 300 0020',
  '+41 79 300 0021', '+41 79 300 0022', '+41 79 300 0023', '+41 79 300 0024',
  '+41 79 300 0025', '+41 79 300 0026', '+41 79 300 0027', '+41 79 300 0028',
  '+41 79 300 0029', '+41 79 300 0030',
]

export const calls: CallRow[] = Array.from({ length: 30 }, (_, i) => {
  const hour = 8 + Math.floor(i / 3)
  const minute = (i % 3) * 20
  const setterIds = [teamMemberId(1), teamMemberId(2), teamMemberId(3)]
  const memberIdx = i % 3
  const duration = callDurations[i] ?? 0
  const startedAt = `2026-03-22T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`

  return {
    id: callId(i + 1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    external_id: `3cx-call-${String(i + 1).padStart(4, '0')}`,
    team_member_id: setterIds[memberIdx] ?? null,
    direction: i % 4 === 0 ? 'inbound' as const : 'outbound' as const,
    status: callStatuses[i] ?? ('answered' as const),
    caller_number: i % 4 === 0 ? (callerNumbers[i] ?? '+41 79 300 0000') : '+41 44 500 0000',
    callee_number: i % 4 === 0 ? '+41 44 500 0000' : (callerNumbers[i] ?? '+41 79 300 0000'),
    duration_seconds: duration,
    recording_url: duration > 0 ? `https://storage.alpen-energie.ch/recordings/call-${String(i + 1).padStart(4, '0')}.mp3` : null,
    started_at: startedAt,
    ended_at: duration > 0
      ? `2026-03-22T${String(hour + Math.floor((minute * 60 + duration) / 3600)).padStart(2, '0')}:${String(Math.floor(((minute * 60 + duration) % 3600) / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}.000Z`
      : startedAt,
    created_at: startedAt,
  }
})

// ---------------------------------------------------------------------------
// CALL ANALYSIS — for first 5 answered calls
// ---------------------------------------------------------------------------

export const callAnalyses: CallAnalysisRow[] = calls
  .filter((c) => c.status === 'answered' && c.duration_seconds > 120)
  .slice(0, 5)
  .map((c, i) => ({
    id: callAnalysisId(i + 1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    call_id: c.id,
    call_started_at: c.started_at,
    transcript: `[Transkript des Anrufs ${i + 1} - automatisch generiert]`,
    greeting_score: [7, 8, 6, 9, 7][i] ?? 7,
    needs_analysis_score: [8, 7, 5, 8, 6][i] ?? 7,
    presentation_score: [7, 9, 6, 7, 8][i] ?? 7,
    closing_score: [6, 8, 4, 8, 7][i] ?? 6,
    overall_score: [7, 8, 5, 8, 7][i] ?? 7,
    suggestions: {
      improvements: [
        'Bedarfsanalyse vertiefen',
        'Mehr offene Fragen stellen',
        'Einwandbehandlung \u00fcben',
      ],
      strengths: [
        'Freundliche Begr\u00fcssung',
        'Gute Produktkenntnis',
      ],
    },
    script_adherence: ['82.50', '91.00', '65.00', '88.50', '79.00'][i] ?? '80.00',
    model_version: 'claude-sonnet-4-6',
    analyzed_at: '2026-03-22T18:00:00.000Z',
    created_at: '2026-03-22T18:00:00.000Z',
  }))

// ---------------------------------------------------------------------------
// PHASE DEFINITIONS (alpen-energie) — 27 phases for PV/heat pump installation
// ---------------------------------------------------------------------------

const phaseNames: Array<{ name: string; desc: string; color: string; stallDays: number }> = [
  { name: 'Lead eingegangen', desc: 'Neuer Lead im System erfasst', color: '#E5E7EB', stallDays: 2 },
  { name: 'Erstkontakt', desc: 'Erster telefonischer Kontakt mit dem Kunden', color: '#DBEAFE', stallDays: 3 },
  { name: 'Bedarfsanalyse', desc: 'Kundenbed\u00fcrfnisse und Anforderungen erfasst', color: '#BFDBFE', stallDays: 5 },
  { name: 'Vor-Ort-Termin geplant', desc: 'Beratungstermin vor Ort vereinbart', color: '#93C5FD', stallDays: 7 },
  { name: 'Vor-Ort-Termin durchgef\u00fchrt', desc: 'Beratung und Dachvermessung abgeschlossen', color: '#60A5FA', stallDays: 5 },
  { name: 'Angebot erstellt', desc: 'Detailliertes Angebot ausgearbeitet', color: '#3B82F6', stallDays: 3 },
  { name: 'Angebot versendet', desc: 'Angebot an Kunden \u00fcbermittelt', color: '#2563EB', stallDays: 7 },
  { name: 'Nachfassung', desc: 'Follow-up nach Angebotsversand', color: '#1D4ED8', stallDays: 5 },
  { name: 'Verhandlung', desc: 'Preisverhandlung und Angebotsanpassung', color: '#1E40AF', stallDays: 10 },
  { name: 'Auftrag erteilt', desc: 'Kunde hat Auftrag unterschrieben', color: '#10B981', stallDays: 3 },
  { name: 'Anzahlung erhalten', desc: 'Anzahlung eingegangen', color: '#059669', stallDays: 7 },
  { name: 'Bewilligungen eingereicht', desc: 'Baubewilligung und F\u00f6rderantr\u00e4ge eingereicht', color: '#047857', stallDays: 14 },
  { name: 'Bewilligungen erhalten', desc: 'Alle Bewilligungen genehmigt', color: '#065F46', stallDays: 5 },
  { name: 'Material bestellt', desc: 'Panels, Wechselrichter, W\u00e4rmepumpe bestellt', color: '#F59E0B', stallDays: 14 },
  { name: 'Material eingetroffen', desc: 'Alle Materialien im Lager', color: '#D97706', stallDays: 5 },
  { name: 'Ger\u00fcst geplant', desc: 'Ger\u00fcststellung terminiert', color: '#B45309', stallDays: 7 },
  { name: 'Ger\u00fcst aufgestellt', desc: 'Ger\u00fcst steht am Objekt', color: '#92400E', stallDays: 3 },
  { name: 'Elektroinstallation', desc: 'Elektrische Vorarbeiten abgeschlossen', color: '#78350F', stallDays: 5 },
  { name: 'PV-Montage', desc: 'Panels und Unterkonstruktion montiert', color: '#EF4444', stallDays: 5 },
  { name: 'WP-Installation', desc: 'W\u00e4rmepumpe installiert und angeschlossen', color: '#DC2626', stallDays: 5 },
  { name: 'Inbetriebnahme', desc: 'Anlage in Betrieb genommen und getestet', color: '#B91C1C', stallDays: 3 },
  { name: 'Abnahme intern', desc: 'Interne Qualit\u00e4tskontrolle bestanden', color: '#991B1B', stallDays: 3 },
  { name: 'Abnahme Kunde', desc: 'Kundenabnahme und Einweisung', color: '#7F1D1D', stallDays: 5 },
  { name: 'Ger\u00fcst abgebaut', desc: 'Ger\u00fcst demontiert und abtransportiert', color: '#6B7280', stallDays: 5 },
  { name: 'EW-Anmeldung', desc: 'Anmeldung beim Elektrizit\u00e4tswerk', color: '#4B5563', stallDays: 10 },
  { name: 'Schlussrechnung', desc: 'Schlussrechnung erstellt und versendet', color: '#374151', stallDays: 14 },
  { name: 'Projekt abgeschlossen', desc: 'Alle Arbeiten erledigt, Projekt archiviert', color: '#1F2937', stallDays: 0 },
]

export const phaseDefinitions: PhaseDefinitionRow[] = phaseNames.map((pn, i) => ({
  id: phaseDefId(i + 1),
  tenant_id: TENANT_ALPEN_ENERGIE_ID,
  phase_number: i + 1,
  name: pn.name,
  description: pn.desc,
  color: pn.color,
  stall_threshold_days: pn.stallDays,
  created_at: '2026-01-15T08:00:00.000Z',
}))

// ---------------------------------------------------------------------------
// PROJECTS (alpen-energie) — 15 projects across phases
// ---------------------------------------------------------------------------

const projectData: Array<{
  title: string; customer: string; street: string; zip: string; city: string
  phaseIdx: number; status: ProjectRow['status']; offerIdx: number | null
  beraterIdx: number; leadIdx: number; installDate: string | null; notes: string | null
}> = [
  { title: 'PV 12 kWp Hofmann', customer: 'Werner Hofmann', street: 'Bahnhofstrasse 12', zip: '8001', city: 'Z\u00fcrich', phaseIdx: 25, status: 'active', offerIdx: 1, beraterIdx: 4, leadIdx: 5, installDate: null, notes: 'Schlussrechnung ausstehend' },
  { title: 'WP Luft/Wasser Grunder', customer: 'Urs Grunder', street: 'Industriestrasse 33', zip: '2500', city: 'Biel/Bienne', phaseIdx: 20, status: 'active', offerIdx: 2, beraterIdx: 5, leadIdx: 11, installDate: '2026-03-15', notes: 'Inbetriebnahme l\u00e4uft' },
  { title: 'PV 15 kWp + Wallbox Amstutz', customer: 'Rita Amstutz', street: 'Mattenstrasse 18', zip: '3800', city: 'Interlaken', phaseIdx: 14, status: 'active', offerIdx: 3, beraterIdx: 4, leadIdx: 18, installDate: '2026-04-10', notes: 'Material unterwegs' },
  { title: 'Kombipaket R\u00fcttimann', customer: 'Anna R\u00fcttimann', street: 'Pilatusstrasse 22', zip: '6003', city: 'Luzern', phaseIdx: 9, status: 'active', offerIdx: 4, beraterIdx: 5, leadIdx: 4, installDate: null, notes: 'Verhandlung l\u00e4uft' },
  { title: 'PV Flachdach Kaufmann', customer: 'Brigitte Kaufmann', street: 'Hauptstrasse 5', zip: '4500', city: 'Solothurn', phaseIdx: 7, status: 'active', offerIdx: 5, beraterIdx: 6, leadIdx: 10, installDate: null, notes: 'Angebot versendet, warten auf R\u00fcckmeldung' },
  { title: 'PV 20 kWp Gewerbe Egger', customer: 'Marcel Egger', street: 'Talstrasse 55', zip: '8002', city: 'Z\u00fcrich', phaseIdx: 6, status: 'active', offerIdx: 6, beraterIdx: 4, leadIdx: 15, installDate: null, notes: 'Angebot erstellt' },
  { title: 'Erdw\u00e4rme Kn\u00f6pfel', customer: 'Felix Kn\u00f6pfel', street: 'Bergstrasse 78', zip: '5400', city: 'Baden', phaseIdx: 4, status: 'active', offerIdx: 7, beraterIdx: 5, leadIdx: 17, installDate: null, notes: 'Vor-Ort-Termin geplant' },
  { title: 'PV 10 kWp Bosshard', customer: 'Martin Bosshard', street: 'R\u00f6merstrasse 99', zip: '8400', city: 'Winterthur', phaseIdx: 3, status: 'active', offerIdx: 10, beraterIdx: 5, leadIdx: 9, installDate: null, notes: 'Bedarfsanalyse in Arbeit' },
  { title: 'PV 8 kWp Wenger', customer: 'Peter Wenger', street: 'Freie Strasse 45', zip: '4001', city: 'Basel', phaseIdx: 27, status: 'completed', offerIdx: null, beraterIdx: 4, leadIdx: 3, installDate: '2026-02-20', notes: 'Projekt erfolgreich abgeschlossen' },
  { title: 'WP Umbau Sutter', customer: 'Silvia Sutter', street: 'Grabenstrasse 21', zip: '6004', city: 'Luzern', phaseIdx: 2, status: 'active', offerIdx: null, beraterIdx: 6, leadIdx: 14, installDate: null, notes: 'Erstkontakt hergestellt' },
  { title: 'PV 12 kWp Stocker', customer: 'Franziska Stocker', street: 'Seestrasse 11', zip: '6300', city: 'Zug', phaseIdx: 5, status: 'on_hold', offerIdx: null, beraterIdx: 4, leadIdx: 8, installDate: null, notes: 'Kunde wegen Urlaub nicht erreichbar' },
  { title: 'PV 18 kWp B\u00fcrohaus Bieri', customer: 'J\u00f6rg Bieri', street: 'Bundesplatz 1', zip: '3003', city: 'Bern', phaseIdx: 1, status: 'active', offerIdx: null, beraterIdx: 5, leadIdx: 13, installDate: null, notes: 'Lead eingegangen, Zuweisung steht aus' },
  { title: 'WP Fl\u00fcckiger', customer: 'Doris Fl\u00fcckiger', street: 'Laupenstrasse 42', zip: '3008', city: 'Bern', phaseIdx: 2, status: 'active', offerIdx: null, beraterIdx: 6, leadIdx: 20, installDate: null, notes: 'Erstgespr\u00e4ch gef\u00fchrt, interessiert' },
  { title: 'PV 6 kWp Leuthold', customer: 'Heidi Leuthold', street: 'Sonnenbergstrasse 7', zip: '9000', city: 'St. Gallen', phaseIdx: 18, status: 'active', offerIdx: null, beraterIdx: 4, leadIdx: 12, installDate: '2026-04-05', notes: 'Elektroinstallation l\u00e4uft' },
  { title: 'PV + Speicher Aebi', customer: 'Rudolf Aebi', street: 'Dorfstrasse 67', zip: '3600', city: 'Thun', phaseIdx: 12, status: 'active', offerIdx: null, beraterIdx: 5, leadIdx: 7, installDate: null, notes: 'Bewilligungen eingereicht' },
]

export const projects: ProjectRow[] = projectData.map((pd, i) => ({
  id: projectId(i + 1),
  tenant_id: TENANT_ALPEN_ENERGIE_ID,
  external_id: `reonic-proj-${String(i + 1).padStart(3, '0')}`,
  lead_id: leadId(pd.leadIdx),
  offer_id: pd.offerIdx ? offerId(pd.offerIdx) : null,
  berater_id: teamMemberId(pd.beraterIdx),
  title: pd.title,
  customer_name: pd.customer,
  address_street: pd.street,
  address_zip: pd.zip,
  address_city: pd.city,
  phase_id: phaseDefId(pd.phaseIdx),
  status: pd.status,
  phase_entered_at: `2026-03-${String(Math.max(1, 23 - pd.phaseIdx)).padStart(2, '0')}T08:00:00.000Z`,
  installation_date: pd.installDate,
  completion_date: pd.status === 'completed' ? '2026-03-01' : null,
  notes: pd.notes,
  created_at: `2026-02-${String(Math.min(28, i + 1)).padStart(2, '0')}T08:00:00.000Z`,
  updated_at: `2026-03-${String(Math.min(23, 10 + i)).padStart(2, '0')}T16:00:00.000Z`,
}))

// ---------------------------------------------------------------------------
// INVOICES (alpen-energie) — 10 invoices
// ---------------------------------------------------------------------------

const invoiceData: Array<{
  number: string; customer: string; amount: string; tax: string; total: string
  status: InvoiceRow['status']; issuedAt: string; dueAt: string; paidAt: string | null
  offerIdx: number | null
}> = [
  { number: 'AE-2026-001', customer: 'Werner Hofmann', amount: '42500.00', tax: '3272.50', total: '45772.50', status: 'paid', issuedAt: '2026-02-15', dueAt: '2026-03-15', paidAt: '2026-03-10', offerIdx: 1 },
  { number: 'AE-2026-002', customer: 'Urs Grunder', amount: '35000.00', tax: '2695.00', total: '37695.00', status: 'sent', issuedAt: '2026-03-01', dueAt: '2026-03-31', paidAt: null, offerIdx: 2 },
  { number: 'AE-2026-003', customer: 'Rita Amstutz', amount: '29000.00', tax: '2233.00', total: '31233.00', status: 'paid', issuedAt: '2026-03-05', dueAt: '2026-04-04', paidAt: '2026-03-18', offerIdx: 3 },
  { number: 'AE-2026-004', customer: 'Peter Wenger', amount: '28500.00', tax: '2194.50', total: '30694.50', status: 'paid', issuedAt: '2026-02-25', dueAt: '2026-03-25', paidAt: '2026-03-20', offerIdx: null },
  { number: 'AE-2026-005', customer: 'Brigitte Kaufmann', amount: '14250.00', tax: '1097.25', total: '15347.25', status: 'draft', issuedAt: '2026-03-20', dueAt: '2026-04-19', paidAt: null, offerIdx: 5 },
  { number: 'AE-2026-006', customer: 'Marcel Egger', amount: '42500.00', tax: '3272.50', total: '45772.50', status: 'overdue', issuedAt: '2026-02-01', dueAt: '2026-03-01', paidAt: null, offerIdx: 6 },
  { number: 'AE-2026-007', customer: 'Heidi Leuthold', amount: '18500.00', tax: '1424.50', total: '19924.50', status: 'sent', issuedAt: '2026-03-15', dueAt: '2026-04-14', paidAt: null, offerIdx: null },
  { number: 'AE-2026-008', customer: 'Rudolf Aebi', amount: '25000.00', tax: '1925.00', total: '26925.00', status: 'partially_paid', issuedAt: '2026-03-01', dueAt: '2026-03-31', paidAt: null, offerIdx: null },
  { number: 'AE-2026-009', customer: 'Franziska Stocker', amount: '38000.00', tax: '2926.00', total: '40926.00', status: 'overdue', issuedAt: '2026-01-20', dueAt: '2026-02-19', paidAt: null, offerIdx: null },
  { number: 'AE-2026-010', customer: 'Maria Bianchi', amount: '15000.00', tax: '1155.00', total: '16155.00', status: 'cancelled', issuedAt: '2026-02-10', dueAt: '2026-03-12', paidAt: null, offerIdx: null },
]

export const invoices: InvoiceRow[] = invoiceData.map((inv, i) => ({
  id: invoiceId(i + 1),
  tenant_id: TENANT_ALPEN_ENERGIE_ID,
  external_id: `bexio-inv-${String(i + 1).padStart(3, '0')}`,
  offer_id: inv.offerIdx ? offerId(inv.offerIdx) : null,
  invoice_number: inv.number,
  customer_name: inv.customer,
  amount_chf: inv.amount,
  tax_chf: inv.tax,
  total_chf: inv.total,
  status: inv.status,
  issued_at: inv.issuedAt,
  due_at: inv.dueAt,
  paid_at: inv.paidAt,
  created_at: `${inv.issuedAt}T08:00:00.000Z`,
  updated_at: NOW,
}))

// ---------------------------------------------------------------------------
// CONNECTORS (alpen-energie) — 5 connectors matching P1 connectors
// ---------------------------------------------------------------------------

export const connectors: ConnectorRow[] = [
  {
    id: connectorId(1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    type: 'reonic',
    name: 'Reonic CRM',
    credentials: {},
    config: { base_url: 'https://api.reonic.com/v1' },
    status: 'active',
    last_synced_at: '2026-03-23T09:45:00.000Z',
    last_error: null,
    sync_interval_minutes: 15,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: NOW,
  },
  {
    id: connectorId(2),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    type: '3cx',
    name: '3CX Cloud Telefonanlage',
    credentials: {},
    config: { webhook_url: 'https://api.alpen-energie.ch/webhooks/3cx' },
    status: 'active',
    last_synced_at: '2026-03-23T09:45:00.000Z',
    last_error: null,
    sync_interval_minutes: 15,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: NOW,
  },
  {
    id: connectorId(3),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    type: 'bexio',
    name: 'Bexio Buchhaltung',
    credentials: {},
    config: { scopes: ['invoice', 'payment', 'contact'] },
    status: 'active',
    last_synced_at: '2026-03-23T09:00:00.000Z',
    last_error: null,
    sync_interval_minutes: 60,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: NOW,
  },
  {
    id: connectorId(4),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    type: 'google_calendar',
    name: 'Google Calendar',
    credentials: {},
    config: { calendars: ['berater@alpen-energie.ch', 'setter@alpen-energie.ch'] },
    status: 'active',
    last_synced_at: '2026-03-23T09:45:00.000Z',
    last_error: null,
    sync_interval_minutes: 15,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: NOW,
  },
  {
    id: connectorId(5),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    type: 'leadnotes',
    name: 'Leadnotes',
    credentials: {},
    config: {},
    status: 'error',
    last_synced_at: '2026-03-22T15:00:00.000Z',
    last_error: 'API rate limit exceeded — retry in 60s',
    sync_interval_minutes: 15,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: NOW,
  },
]

// ---------------------------------------------------------------------------
// KPI SNAPSHOTS — sample daily snapshots
// ---------------------------------------------------------------------------

export const kpiSnapshots: KpiSnapshotRow[] = [
  {
    id: kpiSnapshotId(1),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'setter_daily',
    entity_id: teamMemberId(1),
    period_date: '2026-03-22',
    metrics: {
      calls_total: 12,
      calls_answered: 9,
      reach_rate: 0.75,
      appointments_booked: 3,
      appointment_rate: 0.33,
      avg_call_duration_seconds: 245,
      no_show_rate: 0.1,
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
  {
    id: kpiSnapshotId(2),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'setter_daily',
    entity_id: teamMemberId(2),
    period_date: '2026-03-22',
    metrics: {
      calls_total: 10,
      calls_answered: 7,
      reach_rate: 0.70,
      appointments_booked: 2,
      appointment_rate: 0.29,
      avg_call_duration_seconds: 198,
      no_show_rate: 0.15,
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
  {
    id: kpiSnapshotId(3),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'setter_daily',
    entity_id: teamMemberId(3),
    period_date: '2026-03-22',
    metrics: {
      calls_total: 8,
      calls_answered: 6,
      reach_rate: 0.75,
      appointments_booked: 2,
      appointment_rate: 0.33,
      avg_call_duration_seconds: 275,
      no_show_rate: 0.0,
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
  {
    id: kpiSnapshotId(4),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'berater_daily',
    entity_id: teamMemberId(4),
    period_date: '2026-03-22',
    metrics: {
      appointments_week: 5,
      closing_rate: 0.40,
      offer_volume_chf: 185500,
      avg_deal_duration_days: 28,
      activities_per_day: 8,
      revenue_per_advisor_chf: 42500,
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
  {
    id: kpiSnapshotId(5),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'berater_daily',
    entity_id: teamMemberId(5),
    period_date: '2026-03-22',
    metrics: {
      appointments_week: 4,
      closing_rate: 0.35,
      offer_volume_chf: 138000,
      avg_deal_duration_days: 32,
      activities_per_day: 6,
      revenue_per_advisor_chf: 35000,
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
  {
    id: kpiSnapshotId(6),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'lead_daily',
    entity_id: null,
    period_date: '2026-03-22',
    metrics: {
      new_leads_today: 3,
      unworked_leads: 4,
      avg_response_time_hours: 4.2,
      lead_quality_rate: 0.65,
      sources: {
        website: 8,
        referral: 4,
        partner: 2,
        advertising: 3,
        cold_call: 1,
        leadnotes: 2,
      },
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
  {
    id: kpiSnapshotId(7),
    tenant_id: TENANT_ALPEN_ENERGIE_ID,
    snapshot_type: 'finance_monthly',
    entity_id: null,
    period_date: '2026-03-01',
    metrics: {
      monthly_revenue_chf: 145772.50,
      open_receivables_chf: 86544.50,
      overdue_invoices_count: 2,
      overdue_amount_chf: 86698.50,
      payments_this_week_chf: 31233.00,
    },
    created_at: '2026-03-22T23:00:00.000Z',
  },
]
