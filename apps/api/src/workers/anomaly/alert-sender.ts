// =============================================================================
// Alert Sender — Sends email notifications for critical anomalies via Resend
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { render } from '@react-email/components'
import { AnomalyAlertEmail } from '../../emails/anomaly-alert.js'
import type { AnomalySeverity } from '@enura/types'

// ---------------------------------------------------------------------------
// Service client
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY ?? '')
}

// ---------------------------------------------------------------------------
// Send alerts for un-notified critical/warning anomalies
// ---------------------------------------------------------------------------

export async function sendAnomalyAlerts(companyId: string): Promise<void> {
  const client = getServiceClient()

  // Fetch un-notified anomalies (critical and warning only)
  const { data: anomalies } = await client
    .from('anomalies')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('notified', false)
    .in('severity', ['critical', 'warning'])
    .order('detected_at', { ascending: false })

  if (!anomalies || anomalies.length === 0) return

  // Fetch tenant info for email context
  const { data: tenant } = await client
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()

  const companyName = (tenant as Record<string, unknown> | null)?.['name'] as string ?? 'Unbekannt'

  // Fetch super users and holding admins who should receive alerts
  const recipients: string[] = []

  // Get super user profiles for this tenant
  const { data: superUserRoles } = await client
    .from('profile_roles')
    .select('profile_id')
    .eq('company_id', companyId)

  if (superUserRoles) {
    const profileIds = (superUserRoles as Array<Record<string, unknown>>)
      .map((r) => r['profile_id'] as string)

    if (profileIds.length > 0) {
      // Get roles that are super_user
      const { data: roles } = await client
        .from('roles')
        .select('id')
        .eq('key', 'super_user')
        .eq('company_id', companyId)

      if (roles && roles.length > 0) {
        const roleId = (roles[0] as Record<string, unknown>)['id'] as string

        const { data: superUserProfileRoles } = await client
          .from('profile_roles')
          .select('profile_id')
          .eq('role_id', roleId)

        const superUserIds = (superUserProfileRoles as Array<Record<string, unknown>> | null)
          ?.map((r) => r['profile_id'] as string) ?? []

        if (superUserIds.length > 0) {
          // Fetch auth emails via profiles (using Supabase auth admin)
          const { data: profiles } = await client
            .from('profiles')
            .select('id')
            .in('id', superUserIds)
            .eq('is_active', true)

          for (const profile of profiles ?? []) {
            const profileId = (profile as Record<string, unknown>)['id'] as string
            const { data: authUser } = await client.auth.admin.getUserById(profileId)
            if (authUser?.user?.email) {
              recipients.push(authUser.user.email)
            }
          }
        }
      }
    }
  }

  if (recipients.length === 0) {
    console.log(`[AlertSender] No recipients found for tenant ${companyId}, skipping alert.`)
    // Still mark as notified to avoid retrying endlessly
    const ids = (anomalies as Array<Record<string, unknown>>).map((a) => a['id'] as string)
    await client.from('anomalies').update({ notified: true }).in('id', ids)
    return
  }

  const resend = getResendClient()

  for (const anomaly of anomalies) {
    const rec = anomaly as Record<string, unknown>
    const severity = rec['severity'] as AnomalySeverity
    const severityEmoji = severity === 'critical' ? '\uD83D\uDD34' : '\uD83D\uDFE1'
    const severityLabel = severity === 'critical' ? 'Kritisch' : 'Warnung'

    const emailHtml = await render(
      AnomalyAlertEmail({
        companyName,
        severity,
        type: rec['type'] as string,
        metric: rec['metric'] as string,
        currentValue: Number(rec['current_value']),
        baselineValue: Number(rec['baseline_value']),
        deviationPct: Number(rec['deviation_pct']),
        message: rec['message'] as string,
        detectedAt: rec['detected_at'] as string,
        entityName: rec['entity_name'] as string | null,
      }),
    )

    try {
      await resend.emails.send({
        from: 'Enura BI <alerts@enura.ch>',
        to: recipients,
        subject: `${severityEmoji} ${severityLabel}: ${rec['message'] as string}`.slice(0, 200),
        html: emailHtml,
      })

      // Mark as notified
      await client
        .from('anomalies')
        .update({ notified: true })
        .eq('id', rec['id'] as string)

      console.log(`[AlertSender] Alert sent for anomaly ${rec['id']} to ${recipients.length} recipients.`)
    } catch (err) {
      console.error(`[AlertSender] Failed to send alert for anomaly ${rec['id']}:`, err)
    }
  }
}
