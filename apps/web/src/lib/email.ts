import { Resend } from 'resend'
import { tenantUrl, PLATFORM_ROOT_DOMAIN } from './platform'

/**
 * Self-contained transactional email helper.
 *
 * It never throws: account provisioning must succeed even when email is not
 * configured or the send fails. Callers should surface the temp password to the
 * admin as a fallback whenever `sent` is false.
 */

type SendResult = { sent: boolean; error?: string }

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? `Enura Platform <noreply@${PLATFORM_ROOT_DOMAIN}>`

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  try {
    return new Resend(key)
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email a newly-invited user their temporary credentials and a branded login
 * link. Returns `{ sent: false }` (never throws) when email is unavailable so
 * the caller can fall back to showing the temp password.
 */
export async function sendInviteCredentials(params: {
  to: string
  firstName: string
  tempPassword: string
  companyName: string
  /** Tenant slug, used to build the branded login URL. */
  companySlug?: string | null
}): Promise<SendResult> {
  const client = getClient()
  if (!client) return { sent: false, error: 'RESEND_API_KEY not configured' }

  const loginUrl = params.companySlug
    ? `${tenantUrl(params.companySlug)}/login`
    : `https://${PLATFORM_ROOT_DOMAIN}/login`

  const name = escapeHtml(params.firstName || 'Willkommen')
  const company = escapeHtml(params.companyName)
  const password = escapeHtml(params.tempPassword)
  const email = escapeHtml(params.to)

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
      <h2 style="font-size: 20px;">Willkommen bei ${company}</h2>
      <p>Hallo ${name},</p>
      <p>für Sie wurde ein Zugang zur Enura-Plattform erstellt. Melden Sie sich mit den
      folgenden Zugangsdaten an und vergeben Sie beim ersten Login ein neues Passwort.</p>
      <table style="margin: 16px 0; border-collapse: collapse;">
        <tr><td style="padding: 4px 12px 4px 0; color: #6B7280;">E-Mail</td><td style="font-family: monospace;">${email}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #6B7280;">Temporäres Passwort</td><td style="font-family: monospace;">${password}</td></tr>
      </table>
      <p><a href="${loginUrl}" style="display: inline-block; background: #1A56DB; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px;">Jetzt anmelden</a></p>
      <p style="color: #6B7280; font-size: 12px;">Falls der Button nicht funktioniert: ${escapeHtml(loginUrl)}</p>
    </div>
  `

  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: `Ihr Zugang zu ${params.companyName}`,
      html,
    })
    if (error) return { sent: false, error: error.message }
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'send failed' }
  }
}
