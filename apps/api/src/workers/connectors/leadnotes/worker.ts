import type { ConnectorBase, ConnectorConfig, SyncResult, SyncError } from '../base.js'
import { ConnectorValidationError } from '../base.js'
import { upsertRecords } from '../upsert.js'
import { LeadnotesCredentialsSchema, type LeadnotesCredentials } from './schemas.js'
import { fetchAllLeadsSince, getLeads } from './client.js'
import { deduplicateLeads } from './deduplicate.js'
import { normaliseLead } from './normalise.js'

/**
 * Parse and validate Leadnotes credentials from connector config.
 */
function parseCredentials(connector: ConnectorConfig): LeadnotesCredentials {
  const result = LeadnotesCredentialsSchema.safeParse(connector.credentials)
  if (!result.success) {
    throw new ConnectorValidationError(
      'credentials',
      `Invalid Leadnotes credentials: ${result.error.message}`,
    )
  }
  return result.data
}

export const leadnotesConnector: ConnectorBase = {
  type: 'leadnotes',
  label: 'Leadnotes',
  version: '1.0.0',

  async validate(connector: ConnectorConfig): Promise<void> {
    const credentials = parseCredentials(connector)

    // Verify the API key works by fetching a single page
    try {
      await getLeads(credentials, { page: 1, perPage: 1 })
    } catch (err) {
      throw new ConnectorValidationError(
        'credentials',
        `Leadnotes API validation failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },

  async sync(tenantId: string, connector: ConnectorConfig): Promise<SyncResult> {
    const startTime = Date.now()
    const errors: SyncError[] = []
    let recordsFetched = 0
    let recordsWritten = 0
    let recordsSkipped = 0

    try {
      const credentials = parseCredentials(connector)

      // Incremental sync: only fetch leads created after last sync
      const leads = await fetchAllLeadsSince(credentials, connector.last_synced_at)
      recordsFetched = leads.length

      if (leads.length === 0) {
        return {
          success: true,
          recordsFetched: 0,
          recordsWritten: 0,
          recordsSkipped: 0,
          errors: [],
          durationMs: Date.now() - startTime,
        }
      }

      // Deduplicate against existing leads in the tenant
      const { newLeads, duplicateCount } = await deduplicateLeads(tenantId, leads)
      recordsSkipped = duplicateCount

      if (newLeads.length > 0) {
        const normalised = newLeads.map((lead) => normaliseLead(tenantId, lead))

        const result = await upsertRecords(
          'leads',
          normalised as unknown as Record<string, unknown>[],
          ['tenant_id', 'external_id'],
        )

        recordsWritten = result.written
        errors.push(...result.errors)
      }
    } catch (err) {
      errors.push({
        code: 'LEADNOTES_SYNC_FATAL',
        message: err instanceof Error ? err.message : String(err),
        context: {},
      })
    }

    return {
      success: errors.length === 0,
      recordsFetched,
      recordsWritten,
      recordsSkipped,
      errors,
      durationMs: Date.now() - startTime,
    }
  },
}
