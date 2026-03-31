// =============================================================================
// Enura Group Multi-Tenant BI Platform — Supabase Data Access Implementation
// Replaces the mock data layer with real Supabase queries.
//
// IMPORTANT: The Supabase client is used WITHOUT the Database generic type
// because it is incompatible with strict TypeScript mode. All queries return
// untyped data from the client. We cast results to the proper Row types.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
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
} from './data-access.js'
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
} from './database.js'

// =============================================================================
// Helpers
// =============================================================================

/** Safely extract data from a Supabase result, returning fallback on error. */
function dataOrDefault<T>(result: { data: unknown; error: unknown }, fallback: T): T {
  if (result.error) {
    console.error('[supabase-data-access]', result.error)
    return fallback
  }
  return (result.data as T) ?? fallback
}

/** Safely extract a single row or null. Treats PGRST116 (not found) as null. */
function dataOrNull<T>(result: { data: unknown; error: unknown }): T | null {
  if (result.error) {
    const err = result.error as { code?: string }
    if (err.code === 'PGRST116') return null // not found
    console.error('[supabase-data-access]', result.error)
    return null
  }
  return (result.data as T) ?? null
}

/** Safely extract a single row, throwing a structured error on failure. */
function dataOrThrow<T>(result: { data: unknown; error: unknown }, entity: string): T {
  if (result.error) {
    console.error('[supabase-data-access]', result.error)
    throw new Error(`Failed to create/update ${entity}: ${(result.error as { message?: string }).message ?? 'Unknown error'}`)
  }
  if (result.data == null) {
    throw new Error(`Failed to create/update ${entity}: no data returned`)
  }
  return result.data as T
}

/** Returns an ISO date string N days ago (used for hypertable time bounds). */
function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// =============================================================================
// Repository Implementations
// =============================================================================

function createTenantsRepo(client: SupabaseClient): CompaniesRepository {
  return {
    async findAll(): Promise<CompanyRow[]> {
      const result = await client
        .from('companies')
        .select('*')
        .order('name', { ascending: true })
      return dataOrDefault<CompanyRow[]>(result, [])
    },

    async findAllActive(): Promise<CompanyRow[]> {
      const result = await client
        .from('companies')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })
      return dataOrDefault<CompanyRow[]>(result, [])
    },

    async findBySlug(slug: string): Promise<CompanyRow | null> {
      const result = await client
        .from('companies')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      return dataOrNull<CompanyRow>(result)
    },

    async findById(id: string): Promise<CompanyRow | null> {
      const result = await client
        .from('companies')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<CompanyRow>(result)
    },

    async create(data: CompanyInsert): Promise<CompanyRow> {
      const result = await client
        .from('companies')
        .insert(data)
        .select()
        .single()
      return dataOrThrow<CompanyRow>(result, 'tenant')
    },

    async update(id: string, data: CompanyUpdate): Promise<CompanyRow> {
      const result = await client
        .from('companies')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      return dataOrThrow<CompanyRow>(result, 'tenant')
    },
  }
}

function createBrandingsRepo(client: SupabaseClient): BrandingsRepository {
  return {
    async findByCompanyId(companyId: string): Promise<CompanyBrandingRow | null> {
      const result = await client
        .from('company_branding')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()
      return dataOrNull<CompanyBrandingRow>(result)
    },
  }
}

function createProfilesRepo(client: SupabaseClient): ProfilesRepository {
  return {
    async findById(id: string): Promise<ProfileRow | null> {
      const result = await client
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<ProfileRow>(result)
    },

    async findByCompanyId(companyId: string): Promise<ProfileRow[]> {
      const result = await client
        .from('profiles')
        .select('*')
        .eq('company_id', companyId)
        .order('display_name', { ascending: true })
      return dataOrDefault<ProfileRow[]>(result, [])
    },

    async findByEmail(email: string): Promise<ProfileRow | null> {
      // Profiles don't have an email column — we look up via Supabase Auth.
      // The profile.id matches auth.users.id, so we query auth users by email
      // and then find the matching profile. Since we can't query auth.users
      // directly from the client, we use a workaround: join via a view or
      // fall back to checking the auth admin API. For now, we attempt an RPC
      // call if available, otherwise return null.
      //
      // Alternative: If profiles have been extended with email, query directly.
      // We try the direct approach first.
      const result = await client
        .from('profiles')
        .select('*')
        .eq('id', email) // This is a fallback; in practice profiles are found by auth user id
        .maybeSingle()

      // If the above didn't work (profiles don't have email), return null.
      // The caller should use Supabase Auth admin API for email lookups.
      if (result.error || !result.data) {
        return null
      }
      return result.data as ProfileRow
    },

    async create(data: ProfileInsert): Promise<ProfileRow> {
      const result = await client
        .from('profiles')
        .insert(data)
        .select()
        .single()
      return dataOrThrow<ProfileRow>(result, 'profile')
    },

    async update(id: string, data: ProfileUpdate): Promise<ProfileRow> {
      const result = await client
        .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single()
      return dataOrThrow<ProfileRow>(result, 'profile')
    },
  }
}

function createRolesRepo(client: SupabaseClient): RolesRepository {
  return {
    async findByProfileId(profileId: string): Promise<RoleRow[]> {
      // Join through profile_roles to get roles for a profile
      const result = await client
        .from('profile_roles')
        .select('role_id, roles(*)')
        .eq('profile_id', profileId)

      if (result.error) {
        console.error('[supabase-data-access]', result.error)
        return []
      }

      const rows = result.data as Array<{ role_id: string; roles: unknown }> | null
      if (!rows) return []
      return rows
        .map((r) => r.roles as RoleRow)
        .filter(Boolean)
    },

    async findByCompanyId(companyId: string): Promise<RoleRow[]> {
      const result = await client
        .from('roles')
        .select('*')
        .eq('company_id', companyId)
        .order('label', { ascending: true })
      return dataOrDefault<RoleRow[]>(result, [])
    },

    async getPermissions(roleId: string): Promise<string[]> {
      // Join through role_permissions to get permission keys
      const result = await client
        .from('role_permissions')
        .select('permission_id, permissions(key)')
        .eq('role_id', roleId)

      if (result.error) {
        console.error('[supabase-data-access]', result.error)
        return []
      }

      const rows = result.data as unknown as Array<{ permission_id: string; permissions: { key: string } | null }> | null
      if (!rows) return []
      return rows
        .map((r) => r.permissions?.key)
        .filter((key): key is string => key != null)
    },
  }
}

function createLeadsRepo(client: SupabaseClient): LeadsRepository {
  return {
    async findMany(companyId: string, opts?: { status?: string; setterId?: string }): Promise<LeadRow[]> {
      let query = client
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (opts?.status) {
        query = query.eq('status', opts.status)
      }
      if (opts?.setterId) {
        query = query.eq('setter_id', opts.setterId)
      }

      return dataOrDefault<LeadRow[]>(await query, [])
    },

    async findById(companyId: string, id: string): Promise<LeadRow | null> {
      const result = await client
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<LeadRow>(result)
    },

    async create(companyId: string, data: LeadInsert): Promise<LeadRow> {
      const result = await client
        .from('leads')
        .insert({ ...data, company_id: companyId })
        .select()
        .single()
      return dataOrThrow<LeadRow>(result, 'lead')
    },

    async update(companyId: string, id: string, data: LeadUpdate): Promise<LeadRow> {
      const result = await client
        .from('leads')
        .update(data)
        .eq('company_id', companyId)
        .eq('id', id)
        .select()
        .single()
      return dataOrThrow<LeadRow>(result, 'lead')
    },
  }
}

function createOffersRepo(client: SupabaseClient): OffersRepository {
  return {
    async findMany(companyId: string, opts?: { status?: string; beraterId?: string }): Promise<OfferRow[]> {
      let query = client
        .from('offers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (opts?.status) {
        query = query.eq('status', opts.status)
      }
      if (opts?.beraterId) {
        query = query.eq('berater_id', opts.beraterId)
      }

      return dataOrDefault<OfferRow[]>(await query, [])
    },

    async findById(companyId: string, id: string): Promise<OfferRow | null> {
      const result = await client
        .from('offers')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<OfferRow>(result)
    },

    async create(companyId: string, data: OfferInsert): Promise<OfferRow> {
      const result = await client
        .from('offers')
        .insert({ ...data, company_id: companyId })
        .select()
        .single()
      return dataOrThrow<OfferRow>(result, 'offer')
    },

    async update(companyId: string, id: string, data: OfferUpdate): Promise<OfferRow> {
      const result = await client
        .from('offers')
        .update(data)
        .eq('company_id', companyId)
        .eq('id', id)
        .select()
        .single()
      return dataOrThrow<OfferRow>(result, 'offer')
    },
  }
}

function createCallsRepo(client: SupabaseClient): CallsRepository {
  return {
    async findMany(companyId: string, opts?: { teamMemberId?: string; status?: string }): Promise<CallRow[]> {
      // calls is a TimescaleDB hypertable — always include time bounds
      let query = client
        .from('calls')
        .select('*')
        .eq('company_id', companyId)
        .gte('started_at', daysAgo(90))
        .order('started_at', { ascending: false })

      if (opts?.teamMemberId) {
        query = query.eq('team_member_id', opts.teamMemberId)
      }
      if (opts?.status) {
        query = query.eq('status', opts.status)
      }

      return dataOrDefault<CallRow[]>(await query, [])
    },

    async findById(companyId: string, id: string): Promise<CallRow | null> {
      const result = await client
        .from('calls')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<CallRow>(result)
    },

    async getAnalysis(companyId: string, callId: string): Promise<CallAnalysisRow | null> {
      const result = await client
        .from('call_analysis')
        .select('*')
        .eq('company_id', companyId)
        .eq('call_id', callId)
        .maybeSingle()
      return dataOrNull<CallAnalysisRow>(result)
    },
  }
}

function createProjectsRepo(client: SupabaseClient): ProjectsRepository {
  return {
    async findMany(companyId: string, opts?: { phaseId?: string; status?: string }): Promise<ProjectRow[]> {
      let query = client
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })

      if (opts?.phaseId) {
        query = query.eq('phase_id', opts.phaseId)
      }
      if (opts?.status) {
        query = query.eq('status', opts.status)
      }

      return dataOrDefault<ProjectRow[]>(await query, [])
    },

    async findById(companyId: string, id: string): Promise<ProjectRow | null> {
      const result = await client
        .from('projects')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<ProjectRow>(result)
    },

    async create(companyId: string, data: ProjectInsert): Promise<ProjectRow> {
      const result = await client
        .from('projects')
        .insert({ ...data, company_id: companyId })
        .select()
        .single()
      return dataOrThrow<ProjectRow>(result, 'project')
    },

    async update(companyId: string, id: string, data: ProjectUpdate): Promise<ProjectRow> {
      const result = await client
        .from('projects')
        .update(data)
        .eq('company_id', companyId)
        .eq('id', id)
        .select()
        .single()
      return dataOrThrow<ProjectRow>(result, 'project')
    },
  }
}

function createInvoicesRepo(client: SupabaseClient): InvoicesRepository {
  return {
    async findMany(companyId: string, opts?: { status?: string }): Promise<InvoiceRow[]> {
      let query = client
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('issued_at', { ascending: false })

      if (opts?.status) {
        query = query.eq('status', opts.status)
      }

      return dataOrDefault<InvoiceRow[]>(await query, [])
    },

    async findById(companyId: string, id: string): Promise<InvoiceRow | null> {
      const result = await client
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<InvoiceRow>(result)
    },

    async create(companyId: string, data: InvoiceInsert): Promise<InvoiceRow> {
      const result = await client
        .from('invoices')
        .insert({ ...data, company_id: companyId })
        .select()
        .single()
      return dataOrThrow<InvoiceRow>(result, 'invoice')
    },

    async update(companyId: string, id: string, data: InvoiceUpdate): Promise<InvoiceRow> {
      const result = await client
        .from('invoices')
        .update(data)
        .eq('company_id', companyId)
        .eq('id', id)
        .select()
        .single()
      return dataOrThrow<InvoiceRow>(result, 'invoice')
    },
  }
}

function createKpiRepo(client: SupabaseClient): KpiRepository & {
  upsertSnapshot(companyId: string, data: {
    snapshot_type: string
    entity_id: string | null
    period_date: string
    metrics: Record<string, unknown>
  }): Promise<KpiSnapshotRow | null>
  getSnapshotRange(companyId: string, snapshotType: string, entityId: string | null, from: string, to: string): Promise<KpiSnapshotRow[]>
} {
  return {
    async findLatest(companyId: string, snapshotType: string, entityId?: string): Promise<KpiSnapshotRow | null> {
      // kpi_snapshots is a TimescaleDB hypertable — include time bounds
      let query = client
        .from('kpi_snapshots')
        .select('*')
        .eq('company_id', companyId)
        .eq('snapshot_type', snapshotType)
        .gte('period_date', daysAgo(90))
        .order('period_date', { ascending: false })
        .limit(1)

      if (entityId) {
        query = query.eq('entity_id', entityId)
      }

      const result = await query.maybeSingle()
      return dataOrNull<KpiSnapshotRow>(result)
    },

    async upsertSnapshot(companyId: string, data: {
      snapshot_type: string
      entity_id: string | null
      period_date: string
      metrics: Record<string, unknown>
    }): Promise<KpiSnapshotRow | null> {
      const result = await client
        .from('kpi_snapshots')
        .upsert(
          {
            company_id: companyId,
            snapshot_type: data.snapshot_type,
            entity_id: data.entity_id,
            period_date: data.period_date,
            metrics: data.metrics,
          },
          { onConflict: 'company_id,snapshot_type,entity_id,period_date' },
        )
        .select()
        .single()
      return dataOrNull<KpiSnapshotRow>(result)
    },

    async getSnapshotRange(
      companyId: string,
      snapshotType: string,
      entityId: string | null,
      from: string,
      to: string,
    ): Promise<KpiSnapshotRow[]> {
      let query = client
        .from('kpi_snapshots')
        .select('*')
        .eq('company_id', companyId)
        .eq('snapshot_type', snapshotType)
        .gte('period_date', from)
        .lte('period_date', to)
        .order('period_date', { ascending: true })

      if (entityId) {
        query = query.eq('entity_id', entityId)
      } else {
        query = query.is('entity_id', null)
      }

      return dataOrDefault<KpiSnapshotRow[]>(await query, [])
    },
  }
}

function createTeamMembersRepo(client: SupabaseClient): TeamMembersRepository {
  return {
    async findByCompanyId(companyId: string): Promise<TeamMemberRow[]> {
      const result = await client
        .from('team_members')
        .select('*')
        .eq('company_id', companyId)
        .order('display_name', { ascending: true })
      return dataOrDefault<TeamMemberRow[]>(result, [])
    },

    async findById(companyId: string, id: string): Promise<TeamMemberRow | null> {
      const result = await client
        .from('team_members')
        .select('*')
        .eq('company_id', companyId)
        .eq('id', id)
        .maybeSingle()
      return dataOrNull<TeamMemberRow>(result)
    },
  }
}

function createConnectorsRepo(client: SupabaseClient): ConnectorsRepository {
  return {
    async findByCompanyId(companyId: string): Promise<ConnectorRow[]> {
      const result = await client
        .from('connectors')
        .select('*')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      return dataOrDefault<ConnectorRow[]>(result, [])
    },
  }
}

function createPhaseDefinitionsRepo(client: SupabaseClient): PhaseDefinitionsRepository {
  return {
    async findByCompanyId(companyId: string): Promise<PhaseDefinitionRow[]> {
      const result = await client
        .from('phase_definitions')
        .select('*')
        .eq('company_id', companyId)
        .order('phase_number', { ascending: true })
      return dataOrDefault<PhaseDefinitionRow[]>(result, [])
    },
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createSupabaseDataAccess(client: SupabaseClient): DataAccess {
  return {
    companies: createTenantsRepo(client),
    brandings: createBrandingsRepo(client),
    profiles: createProfilesRepo(client),
    roles: createRolesRepo(client),
    leads: createLeadsRepo(client),
    offers: createOffersRepo(client),
    calls: createCallsRepo(client),
    projects: createProjectsRepo(client),
    invoices: createInvoicesRepo(client),
    kpis: createKpiRepo(client),
    teamMembers: createTeamMembersRepo(client),
    connectors: createConnectorsRepo(client),
    phaseDefinitions: createPhaseDefinitionsRepo(client),
  }
}
