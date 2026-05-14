import type {
  ConnectorBase,
  ConnectorConfig,
  SyncResult,
  SyncError,
} from '../base.js'
import { ConnectorValidationError } from '../base.js'
import { ThreeCXApiClient } from './client.js'
import { ThreeCXRecordingSchema, ThreeCXUserSchema } from './schemas.js'
import { normaliseRecording, normaliseExtension } from './normalise.js'
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

function defaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString()
}

const PAGE_SIZE = 100

export class ThreeCXConnector implements ConnectorBase {
  readonly type = '3cx'
  readonly label = '3CX Cloud'
  readonly version = '2.0.0'

  async validate(connector: ConnectorConfig): Promise<void> {
    const creds = connector.credentials as Record<string, string>
    if (!creds['username']) {
      throw new ConnectorValidationError(
        'username',
        'Benutzername ist erforderlich',
      )
    }
    if (!creds['password']) {
      throw new ConnectorValidationError(
        'password',
        'Passwort ist erforderlich',
      )
    }
    if (!creds['apiUrl']) {
      throw new ConnectorValidationError(
        'apiUrl',
        'Basis-URL ist erforderlich (z.B. https://firma.3cx.ch)',
      )
    }

    const client = new ThreeCXApiClient(
      creds['apiUrl'],
      creds['username'],
      creds['password'],
    )
    await client.getExtensions()
  }

  async sync(
    companyId: string,
    connector: ConnectorConfig,
  ): Promise<SyncResult> {
    const startTime = Date.now()
    const creds = connector.credentials as Record<string, string>
    const client = new ThreeCXApiClient(
      creds['apiUrl']!,
      creds['username']!,
      creds['password']!,
    )
    const db = getServiceClient()
    let fetched = 0
    let written = 0
    const errors: SyncError[] = []

    try {
      // -------------------------------------------------------------------
      // Phase 0: Sync extensions (Users) -> team_members
      // -------------------------------------------------------------------
      const rawExtensions = await client.getExtensions()
      const validExtensions: Record<string, unknown>[] = []

      for (const ext of rawExtensions) {
        const result = ThreeCXUserSchema.safeParse(ext)
        if (!result.success) {
          errors.push({
            code: 'VALIDATION',
            message: `User validation failed: ${result.error.message}`,
            context: { entity: 'user', raw: ext },
          })
          continue
        }
        validExtensions.push(normaliseExtension(result.data, companyId))
      }

      fetched += validExtensions.length
      const extResult = await upsertRecords(
        'team_members',
        validExtensions,
        ['company_id', 'external_id'],
      )
      written += extResult.written
      errors.push(...extResult.errors)

      // Build extension-number -> team_member.id map
      const { data: members } = await db
        .from('team_members')
        .select('id, external_id, phone')
        .eq('company_id', companyId)

      const extensionMemberMap = new Map<string, string>()
      for (const m of members ?? []) {
        const member = m as { id: string; external_id: string | null; phone: string | null }
        if (member.phone) {
          extensionMemberMap.set(member.phone, member.id)
        }
        if (member.external_id) {
          extensionMemberMap.set(member.external_id, member.id)
        }
      }

      // -------------------------------------------------------------------
      // Phase 1: Sync recordings -> calls (paginated via OData)
      // -------------------------------------------------------------------
      const syncSince = connector.last_synced_at ?? defaultStartDate()
      let skip = 0

      const recordingsToStore: Array<{
        externalId: string
        recId: string
      }> = []

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const resp = await client.getRecordings({
          top: PAGE_SIZE,
          skip,
          startDate: syncSince,
        })

        const validCalls: Record<string, unknown>[] = []
        for (const c of resp.value) {
          const result = ThreeCXRecordingSchema.safeParse(c)
          if (!result.success) {
            errors.push({
              code: 'VALIDATION',
              message: `Recording validation failed: ${result.error.message}`,
              context: { entity: 'recording', raw: c },
            })
            continue
          }

          const normalised = normaliseRecording(
            result.data,
            companyId,
            extensionMemberMap,
          )
          validCalls.push(normalised)

          if (result.data.RecordingUrl) {
            recordingsToStore.push({
              externalId: `3cx-rec-${result.data.Id}`,
              recId: result.data.Id,
            })
          }
        }

        fetched += validCalls.length
        const callsResult = await upsertRecords(
          'calls',
          validCalls,
          ['company_id', 'external_id'],
        )
        written += callsResult.written
        errors.push(...callsResult.errors)

        if (resp.value.length < PAGE_SIZE || skip + PAGE_SIZE >= resp.totalCount) break
        skip += PAGE_SIZE
        await delay(200)
      }

      // -------------------------------------------------------------------
      // Phase 2: Download and store recordings to Supabase Storage
      // -------------------------------------------------------------------
      const { data: callsNeedingRecordings } = await db
        .from('calls')
        .select('id, external_id, started_at')
        .eq('company_id', companyId)
        .is('recording_url', null)
        .gt('started_at', syncSince)

      const callsNeedingSet = new Set(
        (callsNeedingRecordings ?? []).map(
          (c: { external_id: string }) => c.external_id,
        ),
      )

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

      for (const entry of recordingsToStore) {
        if (!callsNeedingSet.has(entry.externalId)) continue

        const internalCall = callInternalMap.get(entry.externalId)
        if (!internalCall) continue

        try {
          const downloadUrl = await client.getRecordingDownloadUrl(entry.recId)
          const storagePath = await storeRecording(
            companyId,
            internalCall.id,
            downloadUrl,
          )

          if (storagePath) {
            await db
              .from('calls')
              .update({ recording_url: storagePath })
              .eq('id', internalCall.id)
              .eq('started_at', internalCall.started_at)
          }
        } catch (err) {
          errors.push({
            code: 'RECORDING_DOWNLOAD',
            message: `Failed to store recording for ${entry.externalId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
            context: {
              callExternalId: entry.externalId,
              callInternalId: internalCall.id,
            },
          })
        }

        await delay(500)
      }
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
