import { Resend } from 'resend'
import type { BrandTokens } from '@enura/types'
import { InviteSuperUserEmail } from '../emails/invite-super-user.js'
import { InviteUserEmail } from '../emails/invite-user.js'
import { PasswordResetByAdminEmail } from '../emails/password-reset-by-admin.js'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'noreply@enura-platform.com'

export async function sendInviteSuperUserEmail(opts: {
  to: string
  tenantName: string
  loginUrl: string
  tempPassword: string
  branding: BrandTokens
}): Promise<void> {
  await resend.emails.send({
    from: `${opts.tenantName} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: `Willkommen bei ${opts.tenantName} — Ihr Zugang wurde eingerichtet`,
    react: InviteSuperUserEmail({
      tenantName: opts.tenantName,
      loginUrl: opts.loginUrl,
      tempPassword: opts.tempPassword,
      primaryColor: opts.branding.primary,
    }),
  })
}

export async function sendInviteUserEmail(opts: {
  to: string
  tenantName: string
  loginUrl: string
  tempPassword: string
  branding: BrandTokens
}): Promise<void> {
  await resend.emails.send({
    from: `${opts.tenantName} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: `Ihr Zugang zu ${opts.tenantName} wurde eingerichtet`,
    react: InviteUserEmail({
      tenantName: opts.tenantName,
      loginUrl: opts.loginUrl,
      tempPassword: opts.tempPassword,
      primaryColor: opts.branding.primary,
    }),
  })
}

export async function sendPasswordResetEmail(opts: {
  to: string
  tenantName: string
  loginUrl: string
  tempPassword: string
  branding: BrandTokens
}): Promise<void> {
  await resend.emails.send({
    from: `${opts.tenantName} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: `Ihr Passwort für ${opts.tenantName} wurde zurückgesetzt`,
    react: PasswordResetByAdminEmail({
      tenantName: opts.tenantName,
      loginUrl: opts.loginUrl,
      tempPassword: opts.tempPassword,
      primaryColor: opts.branding.primary,
    }),
  })
}
