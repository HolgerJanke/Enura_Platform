import { Resend } from 'resend'

/**
 * Web-side transactional email via Resend.
 *
 * The full React-Email templates live in `apps/api/src/emails`, but the invite
 * flow runs entirely inside the web app's server actions (service client, no
 * hop to the API). Rather than couple web → api at runtime, this module sends
 * the one transactional mail the invite flow needs with a self-contained HTML
 * template.
 *
 * Design rule: sending mail must NEVER break the surrounding operation. The
 * invited user is already created in the database by the time we get here — a
 * missing API key or a Resend outage must degrade to "account created, email
 * not sent", never throw. Every function therefore returns a result object and
 * swallows its own errors.
 */

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'noreply@enura-platform.com'
const DEFAULT_ACCENT = '#1A56DB'

export type SendEmailResult = { sent: boolean; error?: string }

/** Lazily build a Resend client; returns null when the API key is absent. */
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

interface InviteEmailOptions {
  to: string
  firstName: string
  companyName: string
  loginUrl: string
  tempPassword: string
  /** Company brand colour for the button/accent; falls back to Enura blue. */
  primaryColor?: string
}

/**
 * Email a newly invited user their temporary credentials and a login link.
 * Returns `{ sent: false, error }` (never throws) if Resend is unconfigured or
 * the send fails, so the caller can surface a manual-handover fallback.
 */
export async function sendInviteEmail(opts: InviteEmailOptions): Promise<SendEmailResult> {
  const resend = getResend()
  if (!resend) {
    return { sent: false, error: 'RESEND_API_KEY ist nicht konfiguriert.' }
  }

  try {
    const { error } = await resend.emails.send({
      from: `${opts.companyName} <${FROM_EMAIL}>`,
      to: opts.to,
      subject: `Ihr Zugang zu ${opts.companyName} wurde eingerichtet`,
      html: renderInviteHtml(opts),
    })

    if (error) {
      return { sent: false, error: error.message }
    }
    return { sent: true }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler beim E-Mail-Versand.' }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInviteHtml(opts: InviteEmailOptions): string {
  const accent = opts.primaryColor ?? DEFAULT_ACCENT
  const firstName = escapeHtml(opts.firstName)
  const companyName = escapeHtml(opts.companyName)
  const loginUrl = escapeHtml(opts.loginUrl)
  const email = escapeHtml(opts.to)
  const tempPassword = escapeHtml(opts.tempPassword)

  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:20px;color:#111827;">Willkommen bei ${companyName}</h1>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:22px;color:#374151;">
                  Hallo ${firstName},<br />
                  für Sie wurde ein Zugang eingerichtet. Melden Sie sich mit den folgenden Zugangsdaten an:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                  <tr>
                    <td style="padding:16px;">
                      <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">E-Mail</p>
                      <p style="margin:0 0 12px 0;font-size:14px;color:#111827;font-family:'SFMono-Regular',Consolas,monospace;">${email}</p>
                      <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">Temporäres Passwort</p>
                      <p style="margin:0;font-size:14px;color:#111827;font-family:'SFMono-Regular',Consolas,monospace;">${tempPassword}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
                  <tr>
                    <td style="border-radius:8px;background:${accent};">
                      <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Jetzt anmelden</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0;font-size:13px;line-height:20px;color:#6b7280;">
                  Beim ersten Login müssen Sie ein neues Passwort festlegen und die Zwei-Faktor-Authentifizierung (2FA) einrichten. Bewahren Sie diese E-Mail sicher auf, bis Sie sich angemeldet haben.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  Falls die Schaltfläche nicht funktioniert, öffnen Sie diese Adresse: <br />
                  <a href="${loginUrl}" style="color:${accent};word-break:break-all;">${loginUrl}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
