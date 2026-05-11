export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { getDataAccess } from '@/lib/data-access'
import type { OfferRow } from '@enura/types'

function StatusBadge({ status }: { status: string }) {
  const color = status === 'won' ? 'bg-green-50 text-green-700'
    : status === 'sent' ? 'bg-blue-50 text-blue-700'
    : status === 'lost' ? 'bg-red-50 text-red-700'
    : status === 'draft' ? 'bg-yellow-50 text-yellow-700'
    : 'bg-gray-50 text-gray-600'
  const label = status === 'won' ? 'Gewonnen'
    : status === 'sent' ? 'Versendet'
    : status === 'lost' ? 'Verloren'
    : status === 'draft' ? 'Entwurf'
    : status
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color}`}>
      {label}
    </span>
  )
}

export default async function ProcessesPage() {
  const session = await getSession()
  if (!session?.companyId) return null

  const db = getDataAccess()
  const cid = session.companyId

  // Parallel optimized queries — no more fetching ALL offers
  const [
    wonCount,
    wonValue,
    recentOffersResult,
  ] = await Promise.all([
    db.offers.count(cid, { status: 'won' }),
    db.offers.sumAmountChf(cid, { excludeStatus: ['draft', 'sent', 'lost', 'expired'] }),
    db.offers.findPaginated(cid, { minAmountChf: 1, page: 1, pageSize: 20 }),
  ])

  const recentOffers = recentOffersResult.data

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text-primary">Montage & Technik</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Projektabwicklung, Montageplanung und technische Umsetzung
        </p>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Aufträge</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand-kpi-1)' }}>{wonCount}</p>
          <p className="text-xs text-brand-text-secondary mt-1">Gewonnene Projekte</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Auftragswert</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand-kpi-2)' }}>
            {wonValue > 0 ? `CHF ${Math.round(wonValue).toLocaleString('de-CH')}` : 'CHF 0'}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">Gesamt gewonnene Aufträge</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-brand-sm border border-gray-100">
          <p className="text-xs font-medium text-brand-text-secondary uppercase tracking-wide mb-1">Aktive Angebote</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--brand-kpi-3)' }}>
            {recentOffersResult.total}
          </p>
          <p className="text-xs text-brand-text-secondary mt-1">Mit Preisangabe</p>
        </div>
      </div>

      {/* Project Pipeline */}
      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-brand-text-primary">Aktuelle Projekte</h2>
          <p className="text-xs text-brand-text-secondary">
            Top {recentOffers.length} von {recentOffersResult.total}
          </p>
        </div>

        {recentOffers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-2 text-xs font-medium text-brand-text-secondary">Projekt</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-brand-text-secondary">Status</th>
                  <th className="text-right py-3 px-2 text-xs font-medium text-brand-text-secondary">Wert (CHF)</th>
                  <th className="text-left py-3 px-2 text-xs font-medium text-brand-text-secondary">Aktualisiert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOffers.map((offer: OfferRow) => (
                  <tr key={offer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-2">
                      <p className="font-medium text-brand-text-primary">{offer.title || 'Ohne Titel'}</p>
                    </td>
                    <td className="py-3 px-2">
                      <StatusBadge status={offer.status} />
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-brand-text-primary">
                      {(Number(offer.amount_chf) || 0).toLocaleString('de-CH', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-2 text-brand-text-secondary">
                      {offer.updated_at ? new Date(offer.updated_at).toLocaleDateString('de-CH') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-brand-text-secondary">Keine aktiven Projekte vorhanden.</p>
        )}
      </div>
    </div>
  )
}
