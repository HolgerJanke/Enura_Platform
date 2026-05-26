import type {
  ConnectorBase,
  ConnectorConfig,
  SyncResult,
  SyncError,
} from '../base.js'
import { ConnectorValidationError } from '../base.js'
import { ReonicApiClient } from './client.js'
import {
  ReonicUserSchema,
  ReonicLeadSchema,
  ReonicOfferSchema,
} from './schemas.js'
import { normaliseUser, normaliseLead, normaliseOffer } from './normalise.js'
import { upsertRecords } from '../upsert.js'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ReonicConnector implements ConnectorBase {
  readonly type = 'reonic'
  readonly label = 'Reonic CRM'
  readonly version = '1.0.0'

  async validate(connector: ConnectorConfig): Promise<void> {
    const creds = connector.credentials as Record<string, string>
    if (!creds['apiKey']) {
      throw new ConnectorValidationError(
        'apiKey',
        'API-Schlüssel ist erforderlich',
      )
    }
    if (!creds['clientId']) {
      throw new ConnectorValidationError(
        'clientId',
        'Client-ID ist erforderlich',
      )
    }

    // Test connection by fetching users
    const client = new ReonicApiClient(creds['apiKey'], creds['clientId'])
    await client.getUsers()
  }

  async sync(
    companyId: string,
    connector: ConnectorConfig,
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const creds = connector.credentials as Record<string, string>
    const client = new ReonicApiClient(creds['apiKey']!, creds['clientId']!)
    const db = getServiceClient()
    let fetched = 0
    let written = 0
    const errors: SyncError[] = []

    try {
      // -----------------------------------------------------------------------
      // 1. Sync users -> team_members
      // -----------------------------------------------------------------------
      const rawUsers = await client.getUsers()
      const validUsers: Record<string, unknown>[] = []

      for (const u of rawUsers) {
        const result = ReonicUserSchema.safeParse(u)
        if (!result.success) {
          errors.push({
            code: 'VALIDATION',
            message: `User validation failed: ${result.error.message}`,
            context: { entity: 'user', raw: u },
          })
          continue
        }
        validUsers.push(normaliseUser(result.data, companyId))
      }

      fetched += validUsers.length
      const usersResult = await upsertRecords(
        'team_members',
        validUsers,
        ['company_id', 'external_id'],
      )
      written += usersResult.written
      errors.push(...usersResult.errors)

      // Build FK map: external_id -> internal UUID
      const { data: members } = await db
        .from('team_members')
        .select('id, external_id')
        .eq('company_id', companyId)

      const memberMap = new Map<string, string>(
        (members ?? []).map((m: { id: string; external_id: string }) => [
          m.external_id,
          m.id,
        ]),
      )

      // -----------------------------------------------------------------------
      // 2. Sync leads (paginated, incremental)
      // -----------------------------------------------------------------------
      let page = 1
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await client.getLeads({
          page,
          perPage: 100,
          ...(connector.last_synced_at ? { updatedSince: connector.last_synced_at } : {}),
        })

        const validLeads: Record<string, unknown>[] = []
        for (const l of resp.data) {
          const result = ReonicLeadSchema.safeParse(l)
          if (!result.success) {
            errors.push({
              code: 'VALIDATION',
              message: `Lead validation failed: ${result.error.message}`,
              context: { entity: 'lead', raw: l },
            })
            continue
          }
          validLeads.push(normaliseLead(result.data, companyId, memberMap))
        }

        fetched += validLeads.length
        const leadsResult = await upsertRecords(
          'leads',
          validLeads,
          ['company_id', 'external_id'],
        )
        written += leadsResult.written
        errors.push(...leadsResult.errors)

        if (page >= resp.totalPages) break
        page++
        await delay(200)
      }

      // Build lead FK map
      const { data: leads } = await db
        .from('leads')
        .select('id, external_id')
        .eq('company_id', companyId)

      const leadMap = new Map<string, string>(
        (leads ?? []).map((l: { id: string; external_id: string }) => [
          l.external_id,
          l.id,
        ]),
      )

      // -----------------------------------------------------------------------
      // 3. Sync offers (paginated, incremental)
      //    h360/offers uses { results, hasNextPage } — no totalPages
      // -----------------------------------------------------------------------
      page = 1
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await client.getOffers({
          page,
          perPage: 100,
          ...(connector.last_synced_at ? { updatedSince: connector.last_synced_at } : {}),
        })

        const validOffers: Record<string, unknown>[] = []
        for (const o of resp.data) {
          const result = ReonicOfferSchema.safeParse(o)
          if (!result.success) {
            errors.push({
              code: 'VALIDATION',
              message: `Offer validation failed: ${result.error.message}`,
              context: { entity: 'offer', raw: o },
            })
            continue
          }
          validOffers.push(
            normaliseOffer(result.data, companyId, memberMap, leadMap),
          )
        }

        fetched += validOffers.length
        const offersResult = await upsertRecords(
          'offers',
          validOffers,
          ['company_id', 'external_id'],
        )
        written += offersResult.written
        errors.push(...offersResult.errors)

        // h360/offers returns hasNextPage instead of totalPages
        if (!resp.hasNextPage || resp.data.length === 0) break
        page++
        await delay(200)
      }

      // -----------------------------------------------------------------------
      // 4. Derive lead statuses from their best offer
      //    Reonic /contacts has no pipeline status — only offers have state.
      //    Priority: won > sent > draft > lost > new
      // -----------------------------------------------------------------------
      const { data: allOffers } = await db
        .from('offers')
        .select('lead_id, status')
        .eq('company_id', companyId)
        .not('lead_id', 'is', null)

      const offerStatusPriority: Record<string, number> = {
        won: 5, sent: 4, negotiating: 3, draft: 2, lost: 1, expired: 0,
      }
      const offerToLead: Record<string, string> = {
        won: 'won', sent: 'qualified', negotiating: 'qualified',
        draft: 'contacted', lost: 'lost', expired: 'lost',
      }

      // Find the best offer status per lead
      const bestPerLead = new Map<string, string>()
      for (const o of (allOffers ?? [])) {
        if (!o.lead_id) continue
        const current = bestPerLead.get(o.lead_id)
        const currentPrio = current ? (offerStatusPriority[current] ?? -1) : -1
        const newPrio = offerStatusPriority[o.status] ?? -1
        if (newPrio > currentPrio) {
          bestPerLead.set(o.lead_id, o.status)
        }
      }

      // Batch-update lead statuses (only where they differ from 'new')
      let leadStatusUpdates = 0
      for (const [leadId, offerStatus] of bestPerLead) {
        const leadStatus = offerToLead[offerStatus] ?? 'new'
        if (leadStatus === 'new') continue // skip — already default
        const { error: updateErr } = await db
          .from('leads')
          .update({ status: leadStatus, updated_at: new Date().toISOString() })
          .eq('id', leadId)
          .eq('company_id', companyId)
        if (updateErr) {
          errors.push({
            code: 'LEAD_STATUS',
            message: `Failed to update lead ${leadId} status: ${updateErr.message}`,
            context: { leadId, targetStatus: leadStatus },
          })
        } else {
          leadStatusUpdates++
        }
      }
      written += leadStatusUpdates

    } catch (err) {
      errors.push({
        code: 'SYNC_FATAL',
        message: err instanceof Error ? err.message : String(err),
        context: { companyId },
      })
    }

    return {
      success: errors.filter((e) => e.code === 'SYNC_FATAL').length === 0,
      recordsFetched: fetched,
      recordsWritten: written,
      recordsSkipped: fetched - written,
      errors,
      durationMs: Date.now() - startTime,
    }
  }
}
