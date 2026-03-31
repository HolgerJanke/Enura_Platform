import { Resend } from 'resend'
import type { BrandTokens } from '@enura/types'
import { InviteSuperUserEmail } from '../emails/invite-super-user.js'
import { InviteUserEmail } from '../emails/invite-user.js'
import { PasswordResetByAdminEmail } from '../emails/password-reset-by-admin.js'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = 'noreply@enura-platform.com'

export async function sendInviteSuperUserEmail(opts: {
  to: string
  companyName: string
  loginUrl: string
  tempPassword: string
  branding: BrandTokens
}): Promise<void> {
  await resend.emails.send({
    from: `${opts.companyName} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: `Willkommen bei ${opts.companyName} — Ihr Zugang wurde eingerichtet`,
    react: InviteSuperUserEmail({
      companyName: opts.companyName,
      loginUrl: opts.loginUrl,
      tempPassword: opts.tempPassword,
      primaryColor: opts.branding.primary,
    }),
  })
}

export async function sendInviteUserEmail(opts: {
  to: string
  companyName: string
  loginUrl: string
  tempPassword: string
  branding: BrandTokens
}): Promise<void> {
  await resend.emails.send({
    from: `${opts.companyName} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: `Ihr Zugang zu ${opts.companyName} wurde eingerichtet`,
    react: InviteUserEmail({
      companyName: opts.companyName,
      loginUrl: opts.loginUrl,
      tempPassword: opts.tempPassword,
      primaryColor: opts.branding.primary,
    }),
  })
}

export async function sendPasswordResetEmail(opts: {
  to: string
  companyName: string
  loginUrl: string
  tempPassword: string
  branding: BrandTokens
}): Promise<void> {
  await resend.emails.send({
    from: `${opts.companyName} <${FROM_EMAIL}>`,
    to: opts.to,
    subject: `Ihr Passwort für ${opts.companyName} wurde zurückgesetzt`,
    react: PasswordResetByAdminEmail({
      companyName: opts.companyName,
      loginUrl: opts.loginUrl,
      tempPassword: opts.tempPassword,
      primaryColor: opts.branding.primary,
    }),
  })
}
