export const dynamic = 'force-dynamic'

import { requirePermission } from '@/lib/permissions'
import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import { formatDate } from '@enura/types'
import type { LeadRow, OfferRow, TeamMemberRow } from '@enura/types'
import Link from 'next/link'
import { notFound } from 'next/navigation'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: 'Neuer Lead', cls: 'bg-green-50 text-green-700 border-green-200' },
    contacted: { label: 'Kontaktiert', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    qualified: { label: 'Qualifiziert', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    appointment_set: { label: 'Termin gebucht', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    appointment_booked: { label: 'Termin gebucht', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    won: { label: 'Gewonnen', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    lost: { label: 'Verloren', cls: 'bg-red-50 text-red-700 border-red-200' },
    disqualified: { label: 'Disqualifiziert', cls: 'bg-gray-50 text-gray-500 border-gray-200' },
    angebot_versendet: { label: 'Angebot versendet', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    erstgespraech: { label: 'Erstgespräch', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    follow_up: { label: 'Follow-up', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    verhandlung: { label: 'Verhandlung', cls: 'bg-pink-50 text-pink-700 border-pink-200' },
  }
  const info = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}

function OfferStatusBadge({ status }: { status: string }) {
  const color = status === 'won' ? 'bg-green-50 text-green-700'
    : status === 'sent' ? 'bg-blue-50 text-blue-700'
    : status === 'lost' ? 'bg-red-50 text-red-700'
    : status === 'draft' ? 'bg-yellow-50 text-yellow-700'
    : 'bg-gray-50 text-gray-600'
  const label = status === 'won' ? 'Gewonnen'
    : status === 'sent' ? 'Versendet'
    : status === 'lost' ? 'Verloren'
    : status === 'draft' ? 'Entwurf'
    : status === 'expired' ? 'Abgelaufen'
    : status
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Info row helper
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-brand-text-secondary">{label}</span>
      <span className="text-sm font-medium text-brand-text-primary text-right">{value || '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('module:leads:read')
  const session = await getSession()
  if (!session?.companyId) return null

  const { id } = await params
  const db = getDataAccess()
  const cid = session.companyId

  const lead = await db.leads.findById(cid, id)
  if (!lead) notFound()

  // Fetch related offers + team members in parallel
  const [offers, teamMembers] = await Promise.all([
    db.offers.findMany(cid),
    db.teamMembers.findByCompanyId(cid),
  ])

  const relatedOffers = offers.filter((o: OfferRow) => o.lead_id === lead.id)
  const memberMap = new Map(teamMembers.map((m: TeamMemberRow) => [m.id, m]))
  const assignedMember = lead.setter_id ? memberMap.get(lead.setter_id) : null

  // Find berater (sales consultant) from offers
  const beraterIds = new Set(relatedOffers.map((o) => o.berater_id).filter(Boolean) as string[])
  const beraters = [...beraterIds].map((bid) => memberMap.get(bid)).filter(Boolean) as TeamMemberRow[]

  // Calculate total offer value
  const totalOfferValue = relatedOffers.reduce((sum, o) => sum + (Number(o.amount_chf) || 0), 0)

  const fullName = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unbekannt'
  const address = [lead.address_street, lead.address_zip, lead.address_city, lead.address_canton]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/leads" className="text-brand-text-secondary hover:text-brand-primary transition-colors">
          Vertrieb & Akquise
        </Link>
        <span className="text-brand-text-secondary">/</span>
        <span className="text-brand-text-primary font-medium">{fullName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-text-primary">{fullName}</h1>
          <p className="text-sm text-brand-text-secondary mt-1">
            Lead erstellt am {formatDate(lead.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalOfferValue > 0 && (
            <span className="text-lg font-bold text-brand-text-primary">
              CHF {totalOfferValue.toLocaleString('de-CH')}
            </span>
          )}
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
            <h2 className="text-base font-semibold text-brand-text-primary mb-4">Kontaktdaten</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                <InfoRow label="Name" value={fullName} />
                <InfoRow label="E-Mail" value={lead.email} />
                <InfoRow label="Telefon" value={lead.phone} />
              </div>
              <div>
                <InfoRow label="Adresse" value={address || null} />
                <InfoRow label="Kanton" value={lead.address_canton} />
                <InfoRow label="Quelle" value={(lead.source ?? 'unbekannt').replace(/_/g, ' ')} />
              </div>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
              <h2 className="text-base font-semibold text-brand-text-primary mb-3">Notizen</h2>
              <div className="text-sm text-brand-text-secondary whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
                {lead.notes}
              </div>
            </div>
          )}

          {/* Related Offers */}
          <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-brand-text-primary">
                Angebote ({relatedOffers.length})
              </h2>
              {totalOfferValue > 0 && (
                <span className="text-sm font-semibold text-brand-text-primary">
                  Total: CHF {totalOfferValue.toLocaleString('de-CH')}
                </span>
              )}
            </div>
            {relatedOffers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2.5 px-2 text-xs font-medium text-brand-text-secondary">Titel</th>
                      <th className="text-left py-2.5 px-2 text-xs font-medium text-brand-text-secondary">Berater</th>
                      <th className="text-left py-2.5 px-2 text-xs font-medium text-brand-text-secondary">Status</th>
                      <th className="text-right py-2.5 px-2 text-xs font-medium text-brand-text-secondary">Wert (CHF)</th>
                      <th className="text-left py-2.5 px-2 text-xs font-medium text-brand-text-secondary">Erstellt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {relatedOffers.map((offer: OfferRow) => {
                      const berater = offer.berater_id ? memberMap.get(offer.berater_id) : null
                      const beraterName = berater
                        ? `${berater.first_name ?? ''} ${berater.last_name ?? ''}`.trim()
                        : null
                      const amount = Number(offer.amount_chf) || 0
                      return (
                        <tr key={offer.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-2 font-medium text-brand-text-primary">
                            {offer.title || 'Ohne Titel'}
                          </td>
                          <td className="py-2.5 px-2 text-brand-text-secondary">
                            {beraterName ? (
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary/10 text-[9px] font-semibold text-brand-primary">
                                  {`${(berater!.first_name ?? '')[0] ?? ''}${(berater!.last_name ?? '')[0] ?? ''}`.toUpperCase()}
                                </span>
                                <span className="text-xs">{beraterName}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 px-2">
                            <OfferStatusBadge status={offer.status} />
                          </td>
                          <td className="py-2.5 px-2 text-right font-medium text-brand-text-primary">
                            {amount > 0
                              ? `CHF ${amount.toLocaleString('de-CH')}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-brand-text-secondary">
                            {formatDate(offer.created_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-brand-text-secondary">Keine Angebote zu diesem Lead.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Timeline */}
          <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
            <h2 className="text-base font-semibold text-brand-text-primary mb-4">Details</h2>
            <InfoRow label="Status" value={lead.status} />
            <InfoRow label="Erstellt" value={formatDate(lead.created_at)} />
            <InfoRow label="Aktualisiert" value={formatDate(lead.updated_at)} />
            {lead.qualified_at && (
              <InfoRow label="Qualifiziert am" value={formatDate(lead.qualified_at)} />
            )}
            <InfoRow label="Externe ID" value={lead.external_id} />
          </div>

          {/* Setter (assigned) */}
          <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
            <h2 className="text-base font-semibold text-brand-text-primary mb-4">Setter</h2>
            {assignedMember ? (
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-semibold text-brand-primary">
                  {`${(assignedMember.first_name ?? '')[0] ?? ''}${(assignedMember.last_name ?? '')[0] ?? ''}`.toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-brand-text-primary">
                    {`${assignedMember.first_name ?? ''} ${assignedMember.last_name ?? ''}`.trim()}
                  </p>
                  <p className="text-xs text-brand-text-secondary">Setter / Akquise</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-brand-text-secondary">Nicht zugewiesen</p>
            )}
          </div>

          {/* Berater (from offers) */}
          <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
            <h2 className="text-base font-semibold text-brand-text-primary mb-4">Berater</h2>
            {beraters.length > 0 ? (
              <div className="space-y-3">
                {beraters.map((b) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                      {`${(b.first_name ?? '')[0] ?? ''}${(b.last_name ?? '')[0] ?? ''}`.toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-brand-text-primary">
                        {`${b.first_name ?? ''} ${b.last_name ?? ''}`.trim()}
                      </p>
                      <p className="text-xs text-brand-text-secondary">Berater / Vertrieb</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-text-secondary">Kein Berater zugewiesen</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
            <h2 className="text-base font-semibold text-brand-text-primary mb-4">Aktionen</h2>
            <div className="space-y-2">
              {lead.email && (
                <a
                  href={`mailto:${lead.email}?subject=Anfrage%20${encodeURIComponent(fullName)}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors w-full"
                >
                  <svg className="h-4 w-4 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  E-Mail senden
                </a>
              )}
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors w-full"
                >
                  <svg className="h-4 w-4 text-brand-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  Anrufen
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
