export const dynamic = 'force-dynamic'

import { requireHoldingAdmin } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { CompanyWizardClient } from './company-wizard-client'

const WIZARD_STEPS = [
  { number: 1, label: 'Unternehmen-Details' },
  { number: 2, label: 'Branding' },
  { number: 3, label: 'Domain' },
  { number: 4, label: 'Super-User Einladung' },
]

export default async function NewCompanyWizardPage() {
  await requireHoldingAdmin()

  const session = await getSession()
  if (!session?.holdingId) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Neues Unternehmen anlegen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Richten Sie ein neues Unternehmen innerhalb Ihres Holdings ein.
        </p>
      </div>

      <CompanyWizardClient
        steps={WIZARD_STEPS}
        holdingId={session.holdingId}
      />
    </div>
  )
}
