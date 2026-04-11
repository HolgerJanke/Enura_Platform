// =============================================================================
// Enura Platform — Mock DataAccess Implementation
// Uses seed data for development and testing without a live database
// =============================================================================

import type {
  CompanyRow,
  CompanyInsert,
  CompanyUpdate,
  CompanyBrandingRow,
  ProfileRow,
  ProfileInsert,
  ProfileUpdate,
  RoleRow,
  LeadRow,
  LeadInsert,
  LeadUpdate,
  OfferRow,
  OfferInsert,
  OfferUpdate,
  CallRow,
  CallAnalysisRow,
  ProjectRow,
  ProjectInsert,
  ProjectUpdate,
  InvoiceRow,
  InvoiceInsert,
  InvoiceUpdate,
  KpiSnapshotRow,
  TeamMemberRow,
  ConnectorRow,
  PhaseDefinitionRow,
} from '../database.js'

import type {
  DataAccess,
  CompaniesRepository,
  BrandingsRepository,
  ProfilesRepository,
  RolesRepository,
  LeadsRepository,
  OffersRepository,
  CallsRepository,
  ProjectsRepository,
  InvoicesRepository,
  KpiRepository,
  TeamMembersRepository,
  ConnectorsRepository,
  PhaseDefinitionsRepository,
} from '../data-access.js'

import {
  tenants as seedTenants,
  tenantBrandings as seedBrandings,
  profiles as seedProfiles,
  roles as seedRoles,
  rolePermissions as seedRolePermissions,
  profileRoles as seedProfileRoles,
  teamMembers as seedTeamMembers,
  leads as seedLeads,
  offers as seedOffers,
  calls as seedCalls,
  callAnalyses as seedCallAnalyses,
  projects as seedProjects,
  phaseDefinitions as seedPhaseDefinitions,
  invoices as seedInvoices,
  connectors as seedConnectors,
  kpiSnapshots as seedKpiSnapshots,
  permissions as seedPermissions,
} from './seed-data.js'

// ---------------------------------------------------------------------------
// Helper — async delay to simulate real data access latency
// ---------------------------------------------------------------------------

async function delay(): Promise<void> {
  await new Promise((r) => setTimeout(r, 2))
}

// ---------------------------------------------------------------------------
// Helper — clone objects to prevent mutation of seed data
// ---------------------------------------------------------------------------

function clone<T>(obj: T): T {
  return structuredClone(obj)
}

// ---------------------------------------------------------------------------
// Helper — strip undefined values from an object to safely merge with spread
// This prevents exactOptionalPropertyTypes violations when spreading updates
// ---------------------------------------------------------------------------

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as Partial<T>
}

// ---------------------------------------------------------------------------
// Tenants Repository
// ---------------------------------------------------------------------------

function createCompaniesRepository(data: CompanyRow[]): CompaniesRepository {
  return {
    async findAll(): Promise<CompanyRow[]> {
      await delay()
      return clone(data)
    },

    async findAllActive(): Promise<CompanyRow[]> {
      await delay()
      return clone(data.filter((t) => t.status === 'active'))
    },

    async findBySlug(slug: string): Promise<CompanyRow | null> {
      await delay()
      const tenant = data.find((t) => t.slug === slug)
      return tenant ? clone(tenant) : null
    },

    async findById(id: string): Promise<CompanyRow | null> {
      await delay()
      const tenant = data.find((t) => t.id === id)
      return tenant ? clone(tenant) : null
    },

    async create(input: CompanyInsert): Promise<CompanyRow> {
      await delay()
      const now = new Date().toISOString()
      const newTenant: CompanyRow = {
        id: input.id ?? crypto.randomUUID(),
        holding_id: input.holding_id,
        slug: input.slug,
        name: input.name,
        status: input.status ?? 'active',
        created_by: input.created_by ?? null,
        created_at: now,
        updated_at: now,
      }
      data.push(newTenant)
      return clone(newTenant)
    },

    async update(id: string, input: CompanyUpdate): Promise<CompanyRow> {
      await delay()
      const idx = data.findIndex((t) => t.id === id)
      if (idx === -1) throw new Error(`Tenant not found: ${id}`)
      const current = data[idx]!
      const updated = {
        ...current,
        ...stripUndefined(input as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      } as CompanyRow
      data[idx] = updated
      return clone(updated)
    },
  }
}

// ---------------------------------------------------------------------------
// Brandings Repository
// ---------------------------------------------------------------------------

function createBrandingsRepository(data: CompanyBrandingRow[]): BrandingsRepository {
  return {
    async findByCompanyId(companyId: string): Promise<CompanyBrandingRow | null> {
      await delay()
      const branding = data.find((b) => b.company_id === companyId)
      return branding ? clone(branding) : null
    },
  }
}

// ---------------------------------------------------------------------------
// Profiles Repository
// ---------------------------------------------------------------------------

function createProfilesRepository(data: ProfileRow[]): ProfilesRepository {
  return {
    async findById(id: string): Promise<ProfileRow | null> {
      await delay()
      const profile = data.find((p) => p.id === id)
      return profile ? clone(profile) : null
    },

    async findByCompanyId(companyId: string): Promise<ProfileRow[]> {
      await delay()
      return clone(data.filter((p) => p.company_id === companyId))
    },

    async findByEmail(_email: string): Promise<ProfileRow | null> {
      await delay()
      // In the mock layer we don't have emails on the profile table directly;
      // this would normally join with auth.users. Return null for mocks.
      return null
    },

    async create(input: ProfileInsert): Promise<ProfileRow> {
      await delay()
      const now = new Date().toISOString()
      const newProfile: ProfileRow = {
        id: input.id,
        company_id: input.company_id ?? null,
        holding_id: '00000000-0000-0000-0000-000000000010',
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        display_name: [input.first_name, input.last_name].filter(Boolean).join(' ') || 'Unknown',
        avatar_url: input.avatar_url ?? null,
        phone: input.phone ?? null,
        locale: input.locale ?? 'de-CH',
        must_reset_password: input.must_reset_password ?? true,
        password_reset_at: null,
        totp_enabled: input.totp_enabled ?? false,
        totp_enrolled_at: null,
        last_sign_in_at: null,
        is_active: true,
        created_at: now,
        updated_at: now,
      }
      data.push(newProfile)
      return clone(newProfile)
    },

    async update(id: string, input: ProfileUpdate): Promise<ProfileRow> {
      await delay()
      const idx = data.findIndex((p) => p.id === id)
      if (idx === -1) throw new Error(`Profile not found: ${id}`)
      const current = data[idx]!
      const merged = {
        ...current,
        ...stripUndefined(input as Record<string, unknown>),
      }
      const updated = {
        ...merged,
        // Recompute display_name if name fields changed
        display_name: [
          input.first_name !== undefined ? input.first_name : current.first_name,
          input.last_name !== undefined ? input.last_name : current.last_name,
        ]
          .filter(Boolean)
          .join(' ') || 'Unknown',
        updated_at: new Date().toISOString(),
      } as ProfileRow
      data[idx] = updated
      return clone(updated)
    },
  }
}

// ---------------------------------------------------------------------------
// Roles Repository
// ---------------------------------------------------------------------------

function createRolesRepository(
  rolesData: RoleRow[],
  profileRolesData: typeof seedProfileRoles,
  rolePermissionsData: typeof seedRolePermissions,
  permissionsData: typeof seedPermissions,
): RolesRepository {
  return {
    async findByProfileId(profileId: string): Promise<RoleRow[]> {
      await delay()
      const prLinks = profileRolesData.filter((pr) => pr.profile_id === profileId)
      const roleIds = new Set(prLinks.map((pr) => pr.role_id))
      return clone(rolesData.filter((r) => roleIds.has(r.id)))
    },

    async findByCompanyId(companyId: string): Promise<RoleRow[]> {
      await delay()
      return clone(rolesData.filter((r) => r.company_id === companyId))
    },

    async getPermissions(roleId: string): Promise<string[]> {
      await delay()
      const rpLinks = rolePermissionsData.filter((rp) => rp.role_id === roleId)
      const permIds = new Set(rpLinks.map((rp) => rp.permission_id))
      return permissionsData.filter((p) => permIds.has(p.id)).map((p) => p.key)
    },
  }
}

// ---------------------------------------------------------------------------
// Leads Repository
// ---------------------------------------------------------------------------

function createLeadsRepository(data: LeadRow[]): LeadsRepository {
  return {
    async findMany(
      companyId: string,
      opts?: { status?: string; setterId?: string },
    ): Promise<LeadRow[]> {
      await delay()
      let filtered = data.filter((l) => l.company_id === companyId)
      if (opts?.status) {
        filtered = filtered.filter((l) => l.status === opts.status)
      }
      if (opts?.setterId) {
        filtered = filtered.filter((l) => l.setter_id === opts.setterId)
      }
      return clone(filtered)
    },

    async findById(companyId: string, id: string): Promise<LeadRow | null> {
      await delay()
      const lead = data.find((l) => l.id === id && l.company_id === companyId)
      return lead ? clone(lead) : null
    },

    async create(companyId: string, input: LeadInsert): Promise<LeadRow> {
      await delay()
      const now = new Date().toISOString()
      const newLead: LeadRow = {
        id: input.id ?? crypto.randomUUID(),
        company_id: companyId,
        holding_id: '00000000-0000-0000-0000-000000000010',
        external_id: input.external_id ?? null,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address_street: input.address_street ?? null,
        address_zip: input.address_zip ?? null,
        address_city: input.address_city ?? null,
        address_canton: input.address_canton ?? null,
        status: input.status ?? 'new',
        source: input.source ?? 'other',
        setter_id: input.setter_id ?? null,
        notes: input.notes ?? null,
        qualified_at: null,
        created_at: now,
        updated_at: now,
      }
      data.push(newLead)
      return clone(newLead)
    },

    async update(companyId: string, id: string, input: LeadUpdate): Promise<LeadRow> {
      await delay()
      const idx = data.findIndex((l) => l.id === id && l.company_id === companyId)
      if (idx === -1) throw new Error(`Lead not found: ${id}`)
      const updated = {
        ...data[idx]!,
        ...stripUndefined(input as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      } as LeadRow
      data[idx] = updated
      return clone(updated)
    },
  }
}

// ---------------------------------------------------------------------------
// Offers Repository
// ---------------------------------------------------------------------------

function createOffersRepository(data: OfferRow[]): OffersRepository {
  return {
    async findMany(
      companyId: string,
      opts?: { status?: string; beraterId?: string },
    ): Promise<OfferRow[]> {
      await delay()
      let filtered = data.filter((o) => o.company_id === companyId)
      if (opts?.status) {
        filtered = filtered.filter((o) => o.status === opts.status)
      }
      if (opts?.beraterId) {
        filtered = filtered.filter((o) => o.berater_id === opts.beraterId)
      }
      return clone(filtered)
    },

    async findById(companyId: string, id: string): Promise<OfferRow | null> {
      await delay()
      const offer = data.find((o) => o.id === id && o.company_id === companyId)
      return offer ? clone(offer) : null
    },

    async create(companyId: string, input: OfferInsert): Promise<OfferRow> {
      await delay()
      const now = new Date().toISOString()
      const newOffer: OfferRow = {
        id: input.id ?? crypto.randomUUID(),
        company_id: companyId,
        holding_id: '00000000-0000-0000-0000-000000000010',
        external_id: input.external_id ?? null,
        lead_id: input.lead_id ?? null,
        berater_id: input.berater_id ?? null,
        title: input.title,
        description: input.description ?? null,
        amount_chf: input.amount_chf ?? '0.00',
        status: input.status ?? 'draft',
        sent_at: input.sent_at ?? null,
        decided_at: input.decided_at ?? null,
        valid_until: input.valid_until ?? null,
        created_at: now,
        updated_at: now,
      }
      data.push(newOffer)
      return clone(newOffer)
    },

    async update(companyId: string, id: string, input: OfferUpdate): Promise<OfferRow> {
      await delay()
      const idx = data.findIndex((o) => o.id === id && o.company_id === companyId)
      if (idx === -1) throw new Error(`Offer not found: ${id}`)
      const updated = {
        ...data[idx]!,
        ...stripUndefined(input as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      } as OfferRow
      data[idx] = updated
      return clone(updated)
    },
  }
}

// ---------------------------------------------------------------------------
// Calls Repository
// ---------------------------------------------------------------------------

function createCallsRepository(
  callsData: CallRow[],
  analysesData: CallAnalysisRow[],
): CallsRepository {
  return {
    async findMany(
      companyId: string,
      opts?: { teamMemberId?: string; status?: string },
    ): Promise<CallRow[]> {
      await delay()
      let filtered = callsData.filter((c) => c.company_id === companyId)
      if (opts?.teamMemberId) {
        filtered = filtered.filter((c) => c.team_member_id === opts.teamMemberId)
      }
      if (opts?.status) {
        filtered = filtered.filter((c) => c.status === opts.status)
      }
      return clone(filtered)
    },

    async findById(companyId: string, id: string): Promise<CallRow | null> {
      await delay()
      const call = callsData.find((c) => c.id === id && c.company_id === companyId)
      return call ? clone(call) : null
    },

    async getAnalysis(companyId: string, callId: string): Promise<CallAnalysisRow | null> {
      await delay()
      const analysis = analysesData.find(
        (a) => a.call_id === callId && a.company_id === companyId,
      )
      return analysis ? clone(analysis) : null
    },
  }
}

// ---------------------------------------------------------------------------
// Projects Repository
// ---------------------------------------------------------------------------

function createProjectsRepository(data: ProjectRow[]): ProjectsRepository {
  return {
    async findMany(
      companyId: string,
      opts?: { phaseId?: string; status?: string },
    ): Promise<ProjectRow[]> {
      await delay()
      let filtered = data.filter((p) => p.company_id === companyId)
      if (opts?.phaseId) {
        filtered = filtered.filter((p) => p.phase_id === opts.phaseId)
      }
      if (opts?.status) {
        filtered = filtered.filter((p) => p.status === opts.status)
      }
      return clone(filtered)
    },

    async findById(companyId: string, id: string): Promise<ProjectRow | null> {
      await delay()
      const project = data.find((p) => p.id === id && p.company_id === companyId)
      return project ? clone(project) : null
    },

    async create(companyId: string, input: ProjectInsert): Promise<ProjectRow> {
      await delay()
      const now = new Date().toISOString()
      const newProject: ProjectRow = {
        id: input.id ?? crypto.randomUUID(),
        company_id: companyId,
        holding_id: '00000000-0000-0000-0000-000000000010',
        external_id: input.external_id ?? null,
        lead_id: input.lead_id ?? null,
        offer_id: input.offer_id ?? null,
        berater_id: input.berater_id ?? null,
        title: input.title,
        customer_name: input.customer_name,
        address_street: input.address_street ?? null,
        address_zip: input.address_zip ?? null,
        address_city: input.address_city ?? null,
        phase_id: input.phase_id ?? null,
        status: input.status ?? 'active',
        phase_entered_at: now,
        installation_date: input.installation_date ?? null,
        completion_date: null,
        description: null,
        project_value: null,
        system_size_kwp: null,
        project_start_date: null,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      }
      data.push(newProject)
      return clone(newProject)
    },

    async update(companyId: string, id: string, input: ProjectUpdate): Promise<ProjectRow> {
      await delay()
      const idx = data.findIndex((p) => p.id === id && p.company_id === companyId)
      if (idx === -1) throw new Error(`Project not found: ${id}`)
      const current = data[idx]!
      const updated = {
        ...current,
        ...stripUndefined(input as Record<string, unknown>),
        phase_entered_at:
          input.phase_id !== undefined && input.phase_id !== current.phase_id
            ? new Date().toISOString()
            : current.phase_entered_at,
        updated_at: new Date().toISOString(),
      } as ProjectRow
      data[idx] = updated
      return clone(updated)
    },
  }
}

// ---------------------------------------------------------------------------
// Invoices Repository
// ---------------------------------------------------------------------------

function createInvoicesRepository(data: InvoiceRow[]): InvoicesRepository {
  return {
    async findMany(
      companyId: string,
      opts?: { status?: string },
    ): Promise<InvoiceRow[]> {
      await delay()
      let filtered = data.filter((inv) => inv.company_id === companyId)
      if (opts?.status) {
        filtered = filtered.filter((inv) => inv.status === opts.status)
      }
      return clone(filtered)
    },

    async findById(companyId: string, id: string): Promise<InvoiceRow | null> {
      await delay()
      const invoice = data.find((inv) => inv.id === id && inv.company_id === companyId)
      return invoice ? clone(invoice) : null
    },

    async create(companyId: string, input: InvoiceInsert): Promise<InvoiceRow> {
      await delay()
      const now = new Date().toISOString()
      const newInvoice: InvoiceRow = {
        id: input.id ?? crypto.randomUUID(),
        company_id: companyId,
        holding_id: '00000000-0000-0000-0000-000000000010',
        external_id: input.external_id ?? null,
        offer_id: input.offer_id ?? null,
        invoice_number: input.invoice_number,
        customer_name: input.customer_name,
        amount_chf: input.amount_chf,
        tax_chf: input.tax_chf ?? '0.00',
        total_chf: input.total_chf,
        status: input.status ?? 'draft',
        issued_at: input.issued_at,
        due_at: input.due_at,
        paid_at: null,
        created_at: now,
        updated_at: now,
      }
      data.push(newInvoice)
      return clone(newInvoice)
    },

    async update(companyId: string, id: string, input: InvoiceUpdate): Promise<InvoiceRow> {
      await delay()
      const idx = data.findIndex((inv) => inv.id === id && inv.company_id === companyId)
      if (idx === -1) throw new Error(`Invoice not found: ${id}`)
      const updated = {
        ...data[idx]!,
        ...stripUndefined(input as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      } as InvoiceRow
      data[idx] = updated
      return clone(updated)
    },
  }
}

// ---------------------------------------------------------------------------
// KPI Repository
// ---------------------------------------------------------------------------

function createKpiRepository(data: KpiSnapshotRow[]): KpiRepository {
  return {
    async findLatest(
      companyId: string,
      snapshotType: string,
      entityId?: string,
    ): Promise<KpiSnapshotRow | null> {
      await delay()
      const filtered = data
        .filter((s) => s.company_id === companyId && s.snapshot_type === snapshotType)
        .filter((s) => (entityId ? s.entity_id === entityId : true))
        .sort((a, b) => b.period_date.localeCompare(a.period_date))
      const first = filtered[0]
      return first ? clone(first) : null
    },
  }
}

// ---------------------------------------------------------------------------
// Team Members Repository
// ---------------------------------------------------------------------------

function createTeamMembersRepository(data: TeamMemberRow[]): TeamMembersRepository {
  return {
    async findByCompanyId(companyId: string): Promise<TeamMemberRow[]> {
      await delay()
      return clone(data.filter((tm) => tm.company_id === companyId))
    },

    async findById(companyId: string, id: string): Promise<TeamMemberRow | null> {
      await delay()
      const member = data.find((tm) => tm.id === id && tm.company_id === companyId)
      return member ? clone(member) : null
    },
  }
}

// ---------------------------------------------------------------------------
// Connectors Repository
// ---------------------------------------------------------------------------

function createConnectorsRepository(data: ConnectorRow[]): ConnectorsRepository {
  return {
    async findByCompanyId(companyId: string): Promise<ConnectorRow[]> {
      await delay()
      return clone(data.filter((c) => c.company_id === companyId))
    },
  }
}

// ---------------------------------------------------------------------------
// Phase Definitions Repository
// ---------------------------------------------------------------------------

function createPhaseDefinitionsRepository(data: PhaseDefinitionRow[]): PhaseDefinitionsRepository {
  return {
    async findByCompanyId(companyId: string): Promise<PhaseDefinitionRow[]> {
      await delay()
      return clone(
        data.filter((pd) => pd.company_id === companyId).sort((a, b) => a.phase_number - b.phase_number),
      )
    },
  }
}

// ---------------------------------------------------------------------------
// Factory — createMockDataAccess
// ---------------------------------------------------------------------------

export function createMockDataAccess(): DataAccess {
  // Clone seed data so each mock instance operates on its own copy
  const tenantsData = clone(seedTenants)
  const brandingsData = clone(seedBrandings)
  const profilesData = clone(seedProfiles)
  const rolesData = clone(seedRoles)
  const rolePermsData = clone(seedRolePermissions)
  const profileRolesData = clone(seedProfileRoles)
  const permissionsData = clone(seedPermissions)
  const teamMembersData = clone(seedTeamMembers)
  const leadsData = clone(seedLeads)
  const offersData = clone(seedOffers)
  const callsData = clone(seedCalls)
  const callAnalysesData = clone(seedCallAnalyses)
  const projectsData = clone(seedProjects)
  const phasesData = clone(seedPhaseDefinitions)
  const invoicesData = clone(seedInvoices)
  const connectorsData = clone(seedConnectors)
  const kpiData = clone(seedKpiSnapshots)

  return {
    companies: createCompaniesRepository(tenantsData),
    brandings: createBrandingsRepository(brandingsData),
    profiles: createProfilesRepository(profilesData),
    roles: createRolesRepository(rolesData, profileRolesData, rolePermsData, permissionsData),
    leads: createLeadsRepository(leadsData),
    offers: createOffersRepository(offersData),
    calls: createCallsRepository(callsData, callAnalysesData),
    projects: createProjectsRepository(projectsData),
    invoices: createInvoicesRepository(invoicesData),
    kpis: createKpiRepository(kpiData),
    teamMembers: createTeamMembersRepository(teamMembersData),
    connectors: createConnectorsRepository(connectorsData),
    phaseDefinitions: createPhaseDefinitionsRepository(phasesData),
  }
}
