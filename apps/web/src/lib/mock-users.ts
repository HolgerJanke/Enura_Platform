import type { MockSession } from './auth'

type MockUser = {
  email: string
  password: string
  session: MockSession
}

// ---------------------------------------------------------------------------
// Env-driven defaults — no hardcoded tenant references
// ---------------------------------------------------------------------------

const DEFAULT_COMPANY_ID =
  process.env.DEV_DEFAULT_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001'
const DEFAULT_TENANT_SLUG =
  process.env.DEV_DEFAULT_TENANT_SLUG ?? 'demo'
const MOCK_EMAIL_DOMAIN =
  process.env.DEV_MOCK_EMAIL_DOMAIN ?? `${DEFAULT_TENANT_SLUG}.enura.ch`

// ---------------------------------------------------------------------------
// Mock users — generic roles, no tenant-specific data
// ---------------------------------------------------------------------------

export const mockUsers: MockUser[] = [
  {
    email: 'admin@enura.ch',
    password: 'Test1234!',
    session: {
      userId: 'h0000000-0000-0000-0000-000000000001',
      companyId: null,
      email: 'admin@enura.ch',
      firstName: 'System',
      lastName: 'Admin',
      displayName: 'System Admin',
      roles: ['holding_admin'],
      permissions: ['holding:global'],
      isHoldingAdmin: true,
      mustResetPassword: false,
      totpEnabled: true,
    },
  },
  {
    email: `super@${MOCK_EMAIL_DOMAIN}`,
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000001',
      companyId: DEFAULT_COMPANY_ID,
      email: `super@${MOCK_EMAIL_DOMAIN}`,
      firstName: 'Hans',
      lastName: 'Müller',
      displayName: 'Hans Müller',
      roles: ['super_user'],
      permissions: [
        'module:setter:read', 'module:setter:write',
        'module:berater:read', 'module:berater:write',
        'module:leads:read', 'module:leads:write',
        'module:innendienst:read', 'module:innendienst:write',
        'module:bau:read', 'module:bau:write',
        'module:finance:read', 'module:finance:write',
        'module:reports:read', 'module:reports:write',
        'module:ai:read', 'module:ai:write',
        'module:bots:read', 'module:bots:write',
        'module:admin:read', 'module:admin:write',
      ],
      isHoldingAdmin: false,
      mustResetPassword: false,
      totpEnabled: true,
    },
  },
  {
    email: `gf@${MOCK_EMAIL_DOMAIN}`,
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000002',
      companyId: DEFAULT_COMPANY_ID,
      email: `gf@${MOCK_EMAIL_DOMAIN}`,
      firstName: 'Petra',
      lastName: 'Schneider',
      displayName: 'Petra Schneider',
      roles: ['geschaeftsfuehrung'],
      permissions: [
        'module:setter:read', 'module:berater:read', 'module:leads:read',
        'module:innendienst:read', 'module:bau:read', 'module:finance:read',
        'module:reports:read', 'module:ai:read', 'module:bots:read',
      ],
      isHoldingAdmin: false,
      mustResetPassword: false,
      totpEnabled: true,
    },
  },
  {
    email: `setter@${MOCK_EMAIL_DOMAIN}`,
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000004',
      companyId: DEFAULT_COMPANY_ID,
      email: `setter@${MOCK_EMAIL_DOMAIN}`,
      firstName: 'Lukas',
      lastName: 'Weber',
      displayName: 'Lukas Weber',
      roles: ['setter'],
      permissions: ['module:setter:read'],
      isHoldingAdmin: false,
      mustResetPassword: true,
      totpEnabled: false,
    },
  },
  {
    email: `berater@${MOCK_EMAIL_DOMAIN}`,
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000005',
      companyId: DEFAULT_COMPANY_ID,
      email: `berater@${MOCK_EMAIL_DOMAIN}`,
      firstName: 'Marco',
      lastName: 'Bernasconi',
      displayName: 'Marco Bernasconi',
      roles: ['berater'],
      permissions: ['module:berater:read'],
      isHoldingAdmin: false,
      mustResetPassword: true,
      totpEnabled: false,
    },
  },
  {
    email: `finance@${MOCK_EMAIL_DOMAIN}`,
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000008',
      companyId: DEFAULT_COMPANY_ID,
      email: `finance@${MOCK_EMAIL_DOMAIN}`,
      firstName: 'Elena',
      lastName: 'Fischer',
      displayName: 'Elena Fischer',
      roles: ['buchhaltung'],
      permissions: ['module:finance:read', 'module:finance:write'],
      isHoldingAdmin: false,
      mustResetPassword: true,
      totpEnabled: false,
    },
  },
]

export function findMockUser(email: string, password: string) {
  return mockUsers.find((u) => u.email === email && u.password === password) ?? null
}
