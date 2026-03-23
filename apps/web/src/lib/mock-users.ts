import type { MockSession } from './auth'

type MockUser = {
  email: string
  password: string
  session: MockSession
}

export const mockUsers: MockUser[] = [
  {
    email: 'admin@enura.ch',
    password: 'Test1234!',
    session: {
      userId: 'h0000000-0000-0000-0000-000000000001',
      tenantId: null,
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
    email: 'super@alpen-energie.ch',
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      email: 'super@alpen-energie.ch',
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
        'module:admin:read', 'module:admin:write',
      ],
      isHoldingAdmin: false,
      mustResetPassword: false,
      totpEnabled: true,
    },
  },
  {
    email: 'gf@alpen-energie.ch',
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000002',
      tenantId: '00000000-0000-0000-0000-000000000001',
      email: 'gf@alpen-energie.ch',
      firstName: 'Petra',
      lastName: 'Schneider',
      displayName: 'Petra Schneider',
      roles: ['geschaeftsfuehrung'],
      permissions: [
        'module:setter:read', 'module:berater:read', 'module:leads:read',
        'module:innendienst:read', 'module:bau:read', 'module:finance:read',
        'module:reports:read', 'module:ai:read',
      ],
      isHoldingAdmin: false,
      mustResetPassword: false,
      totpEnabled: true,
    },
  },
  {
    email: 'setter@alpen-energie.ch',
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000004',
      tenantId: '00000000-0000-0000-0000-000000000001',
      email: 'setter@alpen-energie.ch',
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
    email: 'berater@alpen-energie.ch',
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000005',
      tenantId: '00000000-0000-0000-0000-000000000001',
      email: 'berater@alpen-energie.ch',
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
    email: 'finance@alpen-energie.ch',
    password: 'Test1234!',
    session: {
      userId: 'a0000000-0000-0000-0000-000000000008',
      tenantId: '00000000-0000-0000-0000-000000000001',
      email: 'finance@alpen-energie.ch',
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
