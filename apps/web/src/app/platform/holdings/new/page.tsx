export const dynamic = 'force-dynamic'

import { requireEnuraAdmin } from '@/lib/permissions'
import { WizardClient } from './wizard-client'

const WIZARD_STEPS = [
  { number: 1, label: 'Holding-Details' },
  { number: 2, label: 'Branding' },
  { number: 3, label: 'Sprache & Region' },
  { number: 4, label: 'Erstes Unternehmen' },
  { number: 5, label: 'Admin-Einladung' },
  { number: 6, label: 'Zusammenfassung' },
]

export default async function NewHoldingWizardPage() {
  await requireEnuraAdmin()

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Neues Holding anlegen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Durchlaufen Sie den Assistenten, um ein neues Holding mit Branding, Unternehmen und Admin einzurichten.
        </p>
      </div>

      <WizardClient steps={WIZARD_STEPS} />
    </div>
  )
}
