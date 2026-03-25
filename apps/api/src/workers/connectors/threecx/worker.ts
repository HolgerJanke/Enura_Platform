import type {
  ConnectorBase,
  ConnectorConfig,
  SyncResult,
  SyncError,
} from '../base.js'
import { ConnectorValidationError } from '../base.js'
import { ThreeCXApiClient } from './client.js'
import { ThreeCXCallSchema, ThreeCXExtensionSchema } from './schemas.js'
import { normaliseCall, normaliseExtension } from './normalise.js'
import { upsertRecords } from '../upsert.js'
import { storeRecording } from './recording-storage.js'
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

/**
 * Computes a default start date for the call log query when no
 * previous sync timestamp is available. Defaults to 30 days ago.
 */
function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

export class ThreeCXConnector implements ConnectorBase {
  readonly type = '3cx'
  readonly label = '3CX Cloud'
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

    // Test connection by fetching extensions
    const client = new ThreeCXApiClient(creds['base_url'], creds['api_key'])
    await client.getExtensions()
  }

  async sync(
    tenantId: string,
    connector: ConnectorConfig,
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const creds = connector.credentials as Record<string, string>
    const client = new ThreeCXApiClient(creds['base_url']!, creds['api_key']!)
    const db = getServiceClient()
    let fetched = 0
    let written = 0
    const errors: SyncError[] = []

    try {
      // -------------------------------------------------------------------
      // Phase 0: Sync extensions -> team_members
      // -------------------------------------------------------------------
      const rawExtensions = await client.getExtensions()
      const validExtensions: Record<string, unknown>[] = []

      for (const ext of rawExtensions) {
        const result = ThreeCXExtensionSchema.safeParse(ext)
        if (!result.success) {
          errors.push({
            code: 'VALIDATION',
            message: `Extension validation failed: ${result.error.message}`,
            context: { entity: 'extension', raw: ext },
          })
          continue
        }
        validExtensions.push(normaliseExtension(result.data, tenantId))
      }

      fetched += validExtensions.length
      const extResult = await upsertRecords(
        'team_members',
        validExtensions,
        ['tenant_id', 'external_id'],
      )
      written += extResult.written
      errors.push(...extResult.errors)

      // Build extension-number -> team_member.id map
      // We need to map 3CX extension numbers to team member IDs.
      // The external_id stored is `3cx-ext-{id}`, but calls reference by extension number.
      // So we also need a mapping from extension number -> member id.
      const { data: members } = await db
        .from('team_members')
        .select('id, external_id, phone')
        .eq('tenant_id', tenantId)

      const extensionMemberMap = new Map<string, string>()
      for (const m of members ?? []) {
        const member = m as { id: string; external_id: string | null; phone: string | null }
        // Map by phone (which stores the extension number for 3CX members)
        if (member.phone) {
          extensionMemberMap.set(member.phone, member.id)
        }
        // Also map by external_id for direct lookups
        if (member.external_id) {
          extensionMemberMap.set(member.external_id, member.id)
        }
      }

      // -------------------------------------------------------------------
      // Phase 1: Sync call log metadata (paginated)
      // -------------------------------------------------------------------
      const syncSince = connector.last_synced_at ?? defaultStartDate()
      let page = 1

      // Track calls that have recordings for Phase 2
      const callsWithRecordings: Array<{
        externalId: string
        recordingFile: string
      }> = []

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await client.getCallLog({
          page,
          perPage: 100,
          startDate: syncSince,
        })

        const validCalls: Record<string, unknown>[] = []
        for (const c of resp.data) {
          const result = ThreeCXCallSchema.safeParse(c)
          if (!result.success) {
            errors.push({
              code: 'VALIDATION',
              message: `Call validation failed: ${result.error.message}`,
              context: { entity: 'call', raw: c },
            })
            continue
          }

          const normalised = normaliseCall(
            result.data,
            tenantId,
            extensionMemberMap,
          )
          validCalls.push(normalised)

          // Track calls with recording files for Phase 2
          if (result.data.recording_file) {
            callsWithRecordings.push({
              externalId: result.data.id,
              recordingFile: result.data.recording_file,
            })
          }
        }

        fetched += validCalls.length
        const callsResult = await upsertRecords(
          'calls',
          validCalls,
          ['tenant_id', 'external_id'],
        )
        written += callsResult.written
        errors.push(...callsResult.errors)

        if (page >= resp.totalPages) break
        page++
        await delay(200)
      }

      // -------------------------------------------------------------------
      // Phase 2: Download and store recordings for calls that need them
      // -------------------------------------------------------------------
      // Find calls that have a recording file but no recording_url stored yet
      const { data: callsNeedingRecordings } = await db
        .from('calls')
        .select('id, external_id, started_at')
        .eq('tenant_id', tenantId)
        .is('recording_url', null)
        .gt('started_at', syncSince)

      const callsNeedingSet = new Set(
        (callsNeedingRecordings ?? []).map(
          (c: { external_id: string }) => c.external_id,
        ),
      )

      // Build a map of external_id -> internal call data for updating
      const callInternalMap = new Map<
        string,
        { id: string; started_at: string }
      >()
      for (const c of callsNeedingRecordings ?? []) {
        const call = c as { id: string; external_id: string; started_at: string }
        callInternalMap.set(call.external_id, {
          id: call.id,
          started_at: call.started_at,
        })
      }

      for (const entry of callsWithRecordings) {
        if (!callsNeedingSet.has(entry.externalId)) continue

        const internalCall = callInternalMap.get(entry.externalId)
        if (!internalCall) continue

        try {
          // Get the signed download URL from 3CX
          const downloadUrl = await client.getRecordingUrl(entry.externalId)

          // Download and store in Supabase Storage
          const storagePath = await storeRecording(
            tenantId,
            internalCall.id,
            downloadUrl,
          )

          if (storagePath) {
            // Update the call record with the storage path
            await db
              .from('calls')
              .update({ recording_url: storagePath })
              .eq('id', internalCall.id)
              .eq('started_at', internalCall.started_at)
          }
        } catch (err) {
          errors.push({
            code: 'RECORDING_DOWNLOAD',
            message: `Failed to store recording for call ${entry.externalId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
            context: {
              callExternalId: entry.externalId,
              callInternalId: internalCall.id,
            },
          })
        }

        // Rate-limit recording downloads
        await delay(500)
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
