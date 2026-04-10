import { createSupabaseServerClient } from '@/lib/supabase/server'
import { InviteFormClient } from './invite-form-client'

type InvitePageProps = {
  params: { token: string }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = params
  const supabase = createSupabaseServerClient()

  // Look up invitation by token
  const { data: invitation, error } = await supabase
    .from('user_invitations')
    .select(`
      id, token, email, first_name, last_name,
      company_id, role_key, role_label,
      status, expires_at,
      companies:company_id ( name )
    `)
    .eq('token', token)
    .maybeSingle()

  // Invalid token
  if (error || !invitation) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Ungültige Einladung</h2>
          <p className="mt-2 text-sm text-gray-500">
            Dieser Einladungslink ist ungültig. Bitte wenden Sie sich an Ihren Administrator.
          </p>
        </div>
      </div>
    )
  }

  // Already accepted
  if (invitation.status === 'accepted') {
    return (
      <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Bereits angenommen</h2>
          <p className="mt-2 text-sm text-gray-500">
            Diese Einladung wurde bereits angenommen. Sie können sich unter{' '}
            <a href="/login" className="text-blue-600 hover:underline">/login</a> anmelden.
          </p>
        </div>
      </div>
    )
  }

  // Revoked
  if (invitation.status === 'revoked') {
    return (
      <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Einladung widerrufen</h2>
          <p className="mt-2 text-sm text-gray-500">
            Diese Einladung wurde widerrufen. Bitte wenden Sie sich an Ihren Administrator.
          </p>
        </div>
      </div>
    )
  }

  // Expired
  const expiresAt = new Date(invitation.expires_at as string)
  if (expiresAt < new Date()) {
    return (
      <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Einladung abgelaufen</h2>
          <p className="mt-2 text-sm text-gray-500">
            Diese Einladung ist am{' '}
            {expiresAt.toLocaleDateString('de-CH', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}{' '}
            abgelaufen. Bitte wenden Sie sich an Ihren Administrator für eine neue Einladung.
          </p>
        </div>
      </div>
    )
  }

  // Valid invitation — show form
  const companyRaw = invitation.companies as unknown
  const companyInfo = (Array.isArray(companyRaw) ? companyRaw[0] : companyRaw) as { name: string } | null
  const companyName = companyInfo?.name ?? 'Unbekanntes Unternehmen'

  return (
    <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Einladung annehmen</h2>
        <p className="mt-2 text-sm text-gray-500">
          Sie wurden eingeladen, als <strong>{invitation.role_label}</strong> bei{' '}
          <strong>{companyName}</strong> beizutreten.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="font-medium text-blue-900">E-Mail</dt>
            <dd className="text-blue-700">{invitation.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-blue-900">Unternehmen</dt>
            <dd className="text-blue-700">{companyName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-blue-900">Rolle</dt>
            <dd className="text-blue-700">{invitation.role_label}</dd>
          </div>
        </dl>
      </div>

      <InviteFormClient
        token={token}
        email={invitation.email as string}
        firstName={(invitation.first_name as string) ?? ''}
        lastName={(invitation.last_name as string) ?? ''}
      />
    </div>
  )
}
