import { requirePermission } from '@/lib/permissions'

export default async function InnendienstPage() {
  await requirePermission('module:innendienst:read')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-brand-text-primary mb-2">Innendienst / Planung</h1>
      <p className="text-brand-text-secondary mb-6">Verfuegbar in Phase 5</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">Geplante KPIs</h2>
          <ul className="space-y-2 text-brand-text-secondary">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary flex-shrink-0" />
              Offene Planungsauftraege
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary flex-shrink-0" />
              Blockierte Projekte
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary flex-shrink-0" />
              IA-Status (Installationsanmeldung)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary flex-shrink-0" />
              Planungsdurchlaufzeit
            </li>
          </ul>
        </div>

        <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
          <h2 className="text-lg font-medium text-brand-text-primary mb-4">Datenquellen</h2>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-brand bg-purple-100 text-sm" aria-hidden="true">🔗</span>
              <div>
                <p className="text-sm font-medium text-brand-text-primary">Reonic</p>
                <p className="text-xs text-brand-text-secondary">Projektstatus, Notizen, Phasen</p>
              </div>
            </li>
          </ul>

          <h2 className="text-lg font-medium text-brand-text-primary mt-6 mb-4">Beschreibung</h2>
          <p className="text-sm text-brand-text-secondary">
            Das Innendienst-Modul bietet eine Uebersicht ueber alle Planungsauftraege
            und deren aktuellen Status. Die Mitarbeiter koennen offene Auftraege priorisieren,
            blockierte Projekte identifizieren und den IA-Status (Installationsanmeldung)
            nachverfolgen.
          </p>
        </div>
      </div>
    </div>
  )
}
