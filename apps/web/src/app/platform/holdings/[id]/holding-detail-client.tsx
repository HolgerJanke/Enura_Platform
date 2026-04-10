'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateHolding, suspendHolding, updateSubscription } from './actions'
import type { HoldingRow, CompanyRow } from '@enura/types'

type HoldingSubscription = {
  id: string
  holding_id: string
  plan: string
  company_plan: string
  billing_cycle: string
  ai_calls_enabled: boolean
  process_builder_enabled: boolean
  liquidity_enabled: boolean
  max_companies: number
  max_users_per_company: number
  trial_ends_at: string | null
  activated_at: string | null
  notes: string | null
}

type Props = {
  holding: HoldingRow
  companies: CompanyRow[]
  subscription: HoldingSubscription | null
  totalUsers: number
}

type TabKey = 'uebersicht' | 'companies' | 'subscription'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'companies', label: 'Unternehmen' },
  { key: 'subscription', label: 'Abonnement' },
]

const PLAN_OPTIONS = [
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'scale', label: 'Scale' },
  { value: 'enterprise', label: 'Enterprise' },
]

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: 'Aktiv', className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Gesperrt', className: 'bg-red-100 text-red-800' },
  archived: { label: 'Archiviert', className: 'bg-gray-100 text-gray-600' },
}

export function HoldingDetailClient({ holding, companies, subscription, totalUsers }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('uebersicht')
  const [isPending, startTransition] = useTransition()

  // Inline editable fields
  const [editName, setEditName] = useState(holding.name)
  const [editDomain, setEditDomain] = useState(holding.primary_domain ?? '')
  const [editingField, setEditingField] = useState<string | null>(null)

  // Subscription fields
  const [plan, setPlan] = useState(subscription?.plan ?? 'professional')
  const [billingCycle, setBillingCycle] = useState(subscription?.billing_cycle ?? 'monthly')
  const [aiEnabled, setAiEnabled] = useState(subscription?.ai_calls_enabled ?? true)
  const [processBuilderEnabled, setProcessBuilderEnabled] = useState(subscription?.process_builder_enabled ?? true)
  const [liquidityEnabled, setLiquidityEnabled] = useState(subscription?.liquidity_enabled ?? true)
  const [maxCompanies, setMaxCompanies] = useState(subscription?.max_companies ?? 10)
  const [maxUsers, setMaxUsers] = useState(subscription?.max_users_per_company ?? 30)

  const handleSaveName = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('holdingId', holding.id)
      formData.set('name', editName)
      await updateHolding(formData)
      setEditingField(null)
    })
  }

  const handleSaveDomain = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('holdingId', holding.id)
      formData.set('primary_domain', editDomain)
      await updateHolding(formData)
      setEditingField(null)
    })
  }

  const handleSuspend = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('holdingId', holding.id)
      await suspendHolding(formData)
    })
  }

  const handleSaveSubscription = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('holdingId', holding.id)
      formData.set('plan', plan)
      formData.set('billing_cycle', billingCycle)
      formData.set('ai_calls_enabled', aiEnabled ? 'true' : 'false')
      formData.set('process_builder_enabled', processBuilderEnabled ? 'true' : 'false')
      formData.set('liquidity_enabled', liquidityEnabled ? 'true' : 'false')
      formData.set('max_companies', String(maxCompanies))
      formData.set('max_users_per_company', String(maxUsers))
      await updateSubscription(formData)
    })
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Holding Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`
                whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors
                ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }
              `}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'uebersicht' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Holding-Details</h2>
            <dl className="space-y-4">
              {/* Name */}
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="flex items-center gap-2">
                  {editingField === 'name' ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        aria-label="Holding-Name bearbeiten"
                      />
                      <button
                        type="button"
                        onClick={handleSaveName}
                        disabled={isPending}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        aria-label="Name speichern"
                      >
                        Speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingField(null); setEditName(holding.name) }}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        aria-label="Abbrechen"
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-900">{holding.name}</span>
                      <button
                        type="button"
                        onClick={() => setEditingField('name')}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        aria-label="Name bearbeiten"
                      >
                        Bearbeiten
                      </button>
                    </>
                  )}
                </dd>
              </div>

              {/* Slug */}
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Slug</dt>
                <dd className="text-sm text-gray-900">{holding.slug}</dd>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${(STATUS_BADGES[holding.status] ?? STATUS_BADGES['active']!).className}`}>
                    {(STATUS_BADGES[holding.status] ?? STATUS_BADGES['active']!).label}
                  </span>
                </dd>
              </div>

              {/* Domain */}
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Primär-Domain</dt>
                <dd className="flex items-center gap-2">
                  {editingField === 'domain' ? (
                    <>
                      <input
                        type="text"
                        value={editDomain}
                        onChange={(e) => setEditDomain(e.target.value)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="holding.example.com"
                        aria-label="Domain bearbeiten"
                      />
                      <button
                        type="button"
                        onClick={handleSaveDomain}
                        disabled={isPending}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        aria-label="Domain speichern"
                      >
                        Speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingField(null); setEditDomain(holding.primary_domain ?? '') }}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        aria-label="Abbrechen"
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-900">{holding.primary_domain ?? 'Nicht konfiguriert'}</span>
                      <button
                        type="button"
                        onClick={() => setEditingField('domain')}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        aria-label="Domain bearbeiten"
                      >
                        Bearbeiten
                      </button>
                    </>
                  )}
                </dd>
              </div>

              {/* Created */}
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Erstellt am</dt>
                <dd className="text-sm text-gray-900">
                  {new Date(holding.created_at).toLocaleDateString('de-CH')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Danger zone */}
          {holding.status === 'active' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
              <h3 className="text-sm font-semibold text-red-800">Gefahrenzone</h3>
              <p className="mt-1 text-sm text-red-700">
                Das Sperren des Holdings deaktiviert den Zugriff für alle Benutzer und Unternehmen.
              </p>
              <button
                type="button"
                onClick={handleSuspend}
                disabled={isPending}
                className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                aria-label="Holding sperren"
              >
                Holding sperren
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'companies' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Unternehmen ({companies.length})
            </h2>
            <Link
              href={`/admin/companies/new?holding=${holding.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              aria-label="Neues Unternehmen hinzufügen"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neues Unternehmen
            </Link>
          </div>

          {companies.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-500">Noch keine Unternehmen vorhanden.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Slug
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Erstellt am
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companies.map((company) => {
                    const badge = STATUS_BADGES[company.status] ?? STATUS_BADGES['active']!
                    return (
                      <tr key={company.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {company.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {company.slug}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                            {badge!.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {new Date(company.created_at).toLocaleDateString('de-CH')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subscription' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Abonnement-Einstellungen</h2>

            <div className="space-y-5">
              {/* Plan */}
              <div>
                <label htmlFor="plan" className="block text-sm font-medium text-gray-700">Plan</label>
                <select
                  id="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Billing cycle */}
              <div>
                <label htmlFor="billing" className="block text-sm font-medium text-gray-700">Abrechnungszyklus</label>
                <select
                  id="billing"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="monthly">Monatlich</option>
                  <option value="annual">Jaehrlich</option>
                </select>
              </div>

              {/* Feature flags */}
              <fieldset>
                <legend className="text-sm font-medium text-gray-700">Feature-Flags</legend>
                <div className="mt-2 space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">KI-Aufrufe aktiviert</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={processBuilderEnabled}
                      onChange={(e) => setProcessBuilderEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Prozess-Builder aktiviert</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={liquidityEnabled}
                      onChange={(e) => setLiquidityEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Liquiditätsplanung aktiviert</span>
                  </label>
                </div>
              </fieldset>

              {/* Limits */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="maxCompanies" className="block text-sm font-medium text-gray-700">
                    Max. Unternehmen
                  </label>
                  <input
                    id="maxCompanies"
                    type="number"
                    min={1}
                    value={maxCompanies}
                    onChange={(e) => setMaxCompanies(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="maxUsers" className="block text-sm font-medium text-gray-700">
                    Max. Benutzer pro Unternehmen
                  </label>
                  <input
                    id="maxUsers"
                    type="number"
                    min={1}
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Usage stats */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-700">Aktuelle Nutzung</h3>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Unternehmen</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {companies.length} / {maxCompanies}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Benutzer (gesamt)</p>
                    <p className="text-lg font-semibold text-gray-900">{totalUsers}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveSubscription}
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                aria-label="Abonnement speichern"
              >
                {isPending ? 'Speichern...' : 'Abonnement speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
