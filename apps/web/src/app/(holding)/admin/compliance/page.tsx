export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ComplianceClient } from './compliance-client'

// ---------------------------------------------------------------------------
// Server Component — Compliance Dashboard
// ---------------------------------------------------------------------------

export default async function CompliancePage() {
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

  // --- Fetch compliance checks with rule info ---
  const { data: rawChecks } = await supabase
    .from('compliance_checks')
    .select('id, rule_id, rule_code, status, severity:compliance_rules(severity), triggered_at, due_at, fulfilled_at, company_id, notes')
    .eq('holding_id', holdingId)
    .order('due_at', { ascending: true })

  // Fetch rules for titles and requirements
  const { data: rawRules } = await supabase
    .from('compliance_rules')
    .select('id, rule_code, title, requirement, severity')
    .eq('is_active', true)

  const ruleMap = new Map<string, { title: string; requirement: string; severity: string }>()
  for (const rule of (rawRules ?? []) as Record<string, unknown>[]) {
    ruleMap.set(rule['id'] as string, {
      title: rule['title'] as string,
      requirement: rule['requirement'] as string,
      severity: rule['severity'] as string,
    })
  }

  // Fetch companies for display names
  const { data: rawCompanies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('holding_id', holdingId)

  const companyMap = new Map<string, string>()
  for (const c of (rawCompanies ?? []) as Record<string, unknown>[]) {
    companyMap.set(c['id'] as string, c['name'] as string)
  }

  const checks = ((rawChecks ?? []) as Record<string, unknown>[]).map((c) => {
    const ruleId = c['rule_id'] as string
    const ruleInfo = ruleMap.get(ruleId)
    const companyId = c['company_id'] as string | null
    return {
      id: c['id'] as string,
      rule_code: c['rule_code'] as string,
      rule_title: ruleInfo?.title ?? (c['rule_code'] as string),
      status: c['status'] as string,
      severity: ruleInfo?.severity ?? 'info',
      triggered_at: c['triggered_at'] as string,
      due_at: c['due_at'] as string,
      fulfilled_at: (c['fulfilled_at'] as string | null) ?? null,
      company_name: companyId ? (companyMap.get(companyId) ?? null) : null,
      notes: (c['notes'] as string | null) ?? null,
      requirement: ruleInfo?.requirement ?? '',
    }
  })

  // --- Fetch compliance documents ---
  const { data: rawDocs } = await supabase
    .from('compliance_documents')
    .select('id, title, document_type, storage_path, file_size, mime_type, valid_from, expires_at, uploaded_at, company_id')
    .eq('holding_id', holdingId)
    .order('uploaded_at', { ascending: false })

  const documents = ((rawDocs ?? []) as Record<string, unknown>[]).map((d) => {
    const companyId = d['company_id'] as string | null
    return {
      id: d['id'] as string,
      title: d['title'] as string,
      document_type: d['document_type'] as string,
      storage_path: d['storage_path'] as string,
      file_size: (d['file_size'] as number) ?? 0,
      mime_type: (d['mime_type'] as string) ?? 'application/octet-stream',
      valid_from: (d['valid_from'] as string | null) ?? null,
      expires_at: (d['expires_at'] as string | null) ?? null,
      uploaded_at: d['uploaded_at'] as string,
      company_name: companyId ? (companyMap.get(companyId) ?? null) : null,
    }
  })

  // --- Fetch certifications ---
  const { data: rawCerts } = await supabase
    .from('certifications')
    .select('id, certification, level, status, certified_at, expires_at, notes')
    .eq('holding_id', holdingId)
    .order('created_at', { ascending: false })

  const certifications = ((rawCerts ?? []) as Record<string, unknown>[]).map((cert) => ({
    id: cert['id'] as string,
    certification: cert['certification'] as string,
    level: cert['level'] as string,
    status: cert['status'] as string,
    certified_at: (cert['certified_at'] as string | null) ?? null,
    expires_at: (cert['expires_at'] as string | null) ?? null,
    notes: (cert['notes'] as string | null) ?? null,
  }))

  // --- Compute summary ---
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const openChecks = checks.filter((c) => c.status === 'open').length
  const overdueChecks = checks.filter((c) => c.status === 'overdue').length
  const fulfilledChecks = checks.filter((c) => c.status === 'fulfilled').length

  const upcomingCertRenewals = certifications.filter((c) => {
    if (!c.expires_at || c.status === 'expired') return false
    const expiry = new Date(c.expires_at)
    return expiry > now && expiry <= thirtyDaysFromNow
  }).length

  const expiringDocuments = documents.filter((d) => {
    if (!d.expires_at) return false
    const expiry = new Date(d.expires_at)
    return expiry > now && expiry <= thirtyDaysFromNow
  }).length

  const summary = {
    openChecks,
    overdueChecks,
    upcomingCertRenewals,
    fulfilledChecks,
    totalDocuments: documents.length,
    expiringDocuments,
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Compliance</h1>
          <p className="text-gray-500 mt-1">
            Datenschutz-Prüfpunkte, Dokumentenverwaltung und Zertifizierungs-Roadmap
          </p>
        </div>
        <Link
          href="/admin/compliance/certifications"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Zertifizierungs-Roadmap
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <ComplianceClient
        checks={checks}
        documents={documents}
        certifications={certifications}
        summary={summary}
      />
    </div>
  )
}
