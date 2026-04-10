import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CertificationEntry {
  id: string
  certification: string
  level: string
  status: string
  certified_at: string | null
  expires_at: string | null
  document_title: string | null
  notes: string | null
  company_name: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  planned: { label: 'Geplant', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  certified: { label: 'Zertifiziert', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  expired: { label: 'Abgelaufen', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
}

const LEVEL_LABELS: Record<string, string> = {
  platform: 'Plattform',
  holding: 'Holding',
  company: 'Unternehmen',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Server Component — Certification Roadmap
// ---------------------------------------------------------------------------

export default async function CertificationsPage() {
  const session = await getSession()
  if (!session) return (<div className="p-8 text-center"><p className="text-gray-500">Nicht angemeldet.</p><a href="/login" className="text-blue-600 underline">Zur Anmeldung</a></div>)
  if (!session.isHoldingAdmin && !session.isEnuraAdmin) return (<div className="p-8 text-center"><a href="/login" className="text-blue-600 underline">Weiter</a></div>)

  const holdingId = session.holdingId
  if (!holdingId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Kein Holding zugewiesen. Bitte kontaktieren Sie den Support.</p>
        </div>
      </div>
    )
  }

  const supabase = createSupabaseServerClient()

  // Fetch certifications with linked documents
  const { data: rawCerts } = await supabase
    .from('certifications')
    .select('id, certification, level, status, certified_at, expires_at, document_id, notes, company_id')
    .eq('holding_id', holdingId)
    .order('created_at', { ascending: true })

  // Fetch documents for linked titles
  const { data: rawDocs } = await supabase
    .from('compliance_documents')
    .select('id, title')
    .eq('holding_id', holdingId)

  const docMap = new Map<string, string>()
  for (const d of (rawDocs ?? []) as Record<string, unknown>[]) {
    docMap.set(d['id'] as string, d['title'] as string)
  }

  // Fetch companies
  const { data: rawCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('holding_id', holdingId)

  const companyMap = new Map<string, string>()
  for (const c of (rawCompanies ?? []) as Record<string, unknown>[]) {
    companyMap.set(c['id'] as string, c['name'] as string)
  }

  const certs: CertificationEntry[] = ((rawCerts ?? []) as Record<string, unknown>[]).map((cert) => {
    const docId = cert['document_id'] as string | null
    const companyId = cert['company_id'] as string | null
    return {
      id: cert['id'] as string,
      certification: cert['certification'] as string,
      level: cert['level'] as string,
      status: cert['status'] as string,
      certified_at: (cert['certified_at'] as string | null) ?? null,
      expires_at: (cert['expires_at'] as string | null) ?? null,
      document_title: docId ? (docMap.get(docId) ?? null) : null,
      notes: (cert['notes'] as string | null) ?? null,
      company_name: companyId ? (companyMap.get(companyId) ?? null) : null,
    }
  })

  // Group by status for roadmap view
  const statusOrder = ['planned', 'in_progress', 'certified', 'expired'] as const

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin/compliance"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Compliance
            </Link>
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm text-gray-900 font-medium">Zertifizierungen</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Zertifizierungs-Roadmap</h1>
          <p className="text-gray-500 mt-1">
            Übersicht aller Zertifizierungen mit Status, Fristen und verknüpften Dokumenten
          </p>
        </div>
      </div>

      {certs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            Noch keine Zertifizierungen angelegt. Zertifizierungen können über die API
            oder direkt in der Datenbank erstellt werden.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Timeline roadmap */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />

            <div className="space-y-6">
              {certs.map((cert, index) => {
                const config = (STATUS_CONFIG[cert.status] ?? STATUS_CONFIG['planned'])!
                return (
                  <div key={cert.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border-2 border-gray-200">
                      <span className={`h-3 w-3 rounded-full ${config.dot}`} />
                    </div>

                    {/* Card */}
                    <div className="flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">{cert.certification}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {LEVEL_LABELS[cert.level] ?? cert.level}
                            </span>
                            {cert.company_name && (
                              <span className="text-xs text-gray-500">
                                — {cert.company_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="text-right text-xs text-gray-500 shrink-0">
                          {cert.certified_at && (
                            <div>Zertifiziert: {formatDate(cert.certified_at)}</div>
                          )}
                          {cert.expires_at && (
                            <div className={
                              new Date(cert.expires_at).getTime() < Date.now()
                                ? 'text-red-600 font-medium'
                                : ''
                            }>
                              Ablauf: {formatDate(cert.expires_at)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-3 space-y-1">
                        {cert.document_title && (
                          <p className="text-xs text-gray-500">
                            Dokument: <span className="font-medium text-gray-700">{cert.document_title}</span>
                          </p>
                        )}
                        {cert.notes && (
                          <p className="text-xs text-gray-600">{cert.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary table */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statusuebersicht</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statusOrder.map((status) => {
                const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['planned']!
                const count = certs.filter((c) => c.status === status).length
                return (
                  <div key={status} className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <span className={`inline-flex h-3 w-3 rounded-full ${config.dot} mb-2`} />
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-500">{config.label}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
