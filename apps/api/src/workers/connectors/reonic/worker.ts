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
    if (!creds['api_key']) {
      throw new ConnectorValidationError(
        'api_key',
        'API-Schlüssel ist erforderlich',
      )
    }
    if (!creds['base_url']) {
      throw new ConnectorValidationError(
        'base_url',
        'Basis-URL ist erforderlich',
      )
    }

    // Test connection by fetching users
    const client = new ReonicApiClient(creds['base_url'], creds['api_key'])
    await client.getUsers()
  }

  async sync(
    tenantId: string,
    connector: ConnectorConfig,
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const creds = connector.credentials as Record<string, string>
    const client = new ReonicApiClient(creds['base_url']!, creds['api_key']!)
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
        validUsers.push(normaliseUser(result.data, tenantId))
      }

      fetched += validUsers.length
      const usersResult = await upsertRecords(
        'team_members',
        validUsers,
        ['tenant_id', 'external_id'],
      )
      written += usersResult.written
      errors.push(...usersResult.errors)

      // Build FK map: external_id -> internal UUID
      const { data: members } = await db
        .from('team_members')
        .select('id, external_id')
        .eq('tenant_id', tenantId)

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
          validLeads.push(normaliseLead(result.data, tenantId, memberMap))
        }

        fetched += validLeads.length
        const leadsResult = await upsertRecords(
          'leads',
          validLeads,
          ['tenant_id', 'external_id'],
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
        .eq('tenant_id', tenantId)

      const leadMap = new Map<string, string>(
        (leads ?? []).map((l: { id: string; external_id: string }) => [
          l.external_id,
          l.id,
        ]),
      )

      // -----------------------------------------------------------------------
      // 3. Sync offers (paginated, incremental)
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
            normaliseOffer(result.data, tenantId, memberMap, leadMap),
          )
        }

        fetched += validOffers.length
        const offersResult = await upsertRecords(
          'offers',
          validOffers,
          ['tenant_id', 'external_id'],
        )
        written += offersResult.written
        errors.push(...offersResult.errors)

        if (page >= resp.totalPages) break
        page++
        await delay(200)
      }
    } catch (err) {
      errors.push({
        code: 'SYNC_FATAL',
        message: err instanceof Error ? err.message : String(err),
        context: { tenantId },
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
