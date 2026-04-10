import Link from 'next/link'
import { requireFinanzplanung } from '@/lib/finanzplanung-guard'

export default async function InvoiceUploadPage() {
  const hasAccess = await requireFinanzplanung()
  if (!hasAccess) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Kein Zugriff auf das Finanzplanung-Modul.</p>
        <Link href="/dashboard" className="text-blue-600 underline text-sm">Zum Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Rechnung hochladen</h1>
        <Link href="/finanzplanung" className="text-sm text-gray-500 hover:text-gray-700">
          ← Zurück
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Laden Sie eine Rechnung als PDF oder Bild hoch. Die KI extrahiert automatisch alle relevanten Daten.
      </p>

      {/* Upload zone — placeholder until KI extraction worker is built */}
      <div className="max-w-2xl">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 hover:border-gray-400 transition-colors">
          <svg className="mb-4 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-gray-700 mb-1">
            PDF, JPG oder PNG hier ablegen
          </p>
          <p className="text-xs text-gray-500 mb-4">oder Datei auswählen (max. 10 MB)</p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
            <p className="text-sm text-amber-800">
              Die KI-Extraktions-Engine wird in einem späteren Schritt aktiviert.
              Nach der Aktivierung werden hochgeladene Rechnungen automatisch analysiert
              und dem Validierungs-Workflow zugewiesen.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Unterstützte Formate</h3>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              PDF-Rechnungen (auch gescannte)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Bilder (JPG, PNG) von Rechnungen
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              E-Rechnungen (ZUGFeRD, XRechnung) — später
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
