'use client'

import { useState } from 'react'
import { updateTenantBrandingAction, updateTenantStatusAction } from './actions'

type Tab = 'overview' | 'branding' | 'users'

// ---------------------------------------------------------------------------
// Impersonation dialog state
// ---------------------------------------------------------------------------
type ImpersonationState = {
  userId: string
  userName: string
  reason: string
  loading: boolean
  result: { token: string; expiresAt: string } | null
  error: string | null
}

type TenantInfo = {
  id: string
  name: string
  slug: string
  status: string
  created_at: string
}

type BrandingInfo = {
  id: string
  primary_color: string
  secondary_color: string
  accent_color: string
  font_family: string
  border_radius: string
} | null

type UserInfo = {
  id: string
  firstName: string | null
  lastName: string | null
  displayName: string
  isActive: boolean
  mustResetPassword: boolean
  totpEnabled: boolean
  createdAt: string
  lastSignInAt: string | null
  roles: string[]
}

type ConnectorInfo = {
  id: string
  name: string
  type: string
  status: string
  lastSyncedAt: string | null
  lastError: string | null
}

type Props = {
  tenant: TenantInfo
  branding: BrandingInfo
  users: UserInfo[]
  superUser: { firstName: string | null; lastName: string | null; displayName: string } | null
  connectors: ConnectorInfo[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('de-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'active': return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' }
    case 'suspended': return { label: 'Gesperrt', classes: 'bg-red-100 text-red-700' }
    case 'archived': return { label: 'Archiviert', classes: 'bg-gray-100 text-gray-500' }
    default: return { label: status, classes: 'bg-gray-100 text-gray-500' }
  }
}

function connectorStatusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'active': return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' }
    case 'paused': return { label: 'Pausiert', classes: 'bg-yellow-100 text-yellow-700' }
    case 'error': return { label: 'Fehler', classes: 'bg-red-100 text-red-700' }
    case 'disconnected': return { label: 'Getrennt', classes: 'bg-gray-100 text-gray-500' }
    default: return { label: status, classes: 'bg-gray-100 text-gray-500' }
  }
}

export function TenantDetailTabs({
  tenant,
  branding,
  users,
  superUser,
  connectors,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [brandingForm, setBrandingForm] = useState({
    primary: branding?.primary_color ?? '#1A56DB',
    secondary: branding?.secondary_color ?? '#1A1A1A',
    accent: branding?.accent_color ?? '#F3A917',
    font: branding?.font_family ?? 'Inter',
    radius: branding?.border_radius ?? '8px',
  })
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [brandingMessage, setBrandingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Impersonation state
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null)

  async function handleImpersonate() {
    if (!impersonation || !impersonation.reason.trim()) return
    setImpersonation((prev) => prev ? { ...prev, loading: true, error: null } : null)

    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: impersonation.userId,
          reason: impersonation.reason,
        }),
      })
      const json = await res.json() as { data?: { token: string; expiresAt: string }; error?: string }

      if (!res.ok || json.error) {
        setImpersonation((prev) =>
          prev ? { ...prev, loading: false, error: json.error ?? 'Unbekannter Fehler' } : null,
        )
        return
      }

      setImpersonation((prev) =>
        prev ? { ...prev, loading: false, result: json.data ?? null } : null,
      )
    } catch {
      setImpersonation((prev) =>
        prev ? { ...prev, loading: false, error: 'Netzwerkfehler' } : null,
      )
    }
  }

  async function handleBrandingSave() {
    setBrandingSaving(true)
    setBrandingMessage(null)

    const result = await updateTenantBrandingAction(tenant.id, {
      primary_color: brandingForm.primary,
      secondary_color: brandingForm.secondary,
      accent_color: brandingForm.accent,
      font_family: brandingForm.font,
      border_radius: brandingForm.radius,
    })

    if (result?.error) {
      setBrandingMessage({ type: 'error', text: result.error })
    } else {
      setBrandingMessage({ type: 'success', text: 'Branding erfolgreich aktualisiert.' })
    }
    setBrandingSaving(false)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Übersicht' },
    { key: 'branding', label: 'Branding' },
    { key: 'users', label: 'Benutzer' },
  ]

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Allgemeine Informationen</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="text-sm font-medium text-gray-900">{tenant.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Subdomain</dt>
                <dd className="text-sm font-mono text-gray-900">{tenant.slug}.platform.com</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(tenant.status).classes}`}>
                    {statusBadge(tenant.status).label}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Erstellt am</dt>
                <dd className="text-sm text-gray-900">{formatDate(tenant.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Benutzer</dt>
                <dd className="text-sm text-gray-900">{users.length}</dd>
              </div>
              {superUser && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Super User</dt>
                  <dd className="text-sm text-gray-900">
                    {superUser.firstName} {superUser.lastName}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Branding preview */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Branding-Vorschau</h2>
            {branding ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border border-gray-300"
                      style={{ backgroundColor: branding.primary_color }}
                    />
                    <div>
                      <p className="text-xs text-gray-500">Primärfarbe</p>
                      <p className="text-sm font-mono text-gray-900">{branding.primary_color}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg border border-gray-300"
                      style={{ backgroundColor: branding.accent_color }}
                    />
                    <div>
                      <p className="text-xs text-gray-500">Akzentfarbe</p>
                      <p className="text-sm font-mono text-gray-900">{branding.accent_color}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Schriftart</p>
                  <p className="text-sm text-gray-900">{branding.font_family}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
                    style={{ backgroundColor: branding.primary_color, borderRadius: branding.border_radius }}
                  >
                    Primär-Button
                  </button>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: branding.accent_color }}
                  >
                    Akzent-Badge
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Kein Branding konfiguriert.</p>
            )}
          </div>

          {/* Connectors */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Connectors</h2>
            {connectors.length === 0 ? (
              <p className="text-sm text-gray-500">Keine Connectors konfiguriert.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Connector
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Typ
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Letzte Synchronisation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {connectors.map((conn) => {
                      const cBadge = connectorStatusBadge(conn.status)
                      return (
                        <tr key={conn.id}>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{conn.name}</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-gray-500">{conn.type}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cBadge.classes}`}>
                              {cBadge.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-500">
                            {conn.lastSyncedAt ? formatDate(conn.lastSyncedAt) : 'Noch nie'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Branding tab */}
      {activeTab === 'branding' && (
        <div className="max-w-2xl">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Branding bearbeiten</h2>

            {brandingMessage && (
              <div
                className={`mb-4 rounded-lg border p-3 text-sm ${
                  brandingMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {brandingMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-primary" className="block text-sm font-medium text-gray-700 mb-1">
                    Primärfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="edit-primary"
                      value={brandingForm.primary}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, primary: e.target.value }))}
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandingForm.primary}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, primary: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Primärfarbe Hex-Wert"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-secondary" className="block text-sm font-medium text-gray-700 mb-1">
                    Sekundärfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="edit-secondary"
                      value={brandingForm.secondary}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, secondary: e.target.value }))}
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandingForm.secondary}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, secondary: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Sekundärfarbe Hex-Wert"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-accent" className="block text-sm font-medium text-gray-700 mb-1">
                    Akzentfarbe
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="edit-accent"
                      value={brandingForm.accent}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, accent: e.target.value }))}
                      className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandingForm.accent}
                      onChange={(e) => setBrandingForm((prev) => ({ ...prev, accent: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      aria-label="Akzentfarbe Hex-Wert"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="edit-font" className="block text-sm font-medium text-gray-700 mb-1">
                    Schriftart
                  </label>
                  <input
                    type="text"
                    id="edit-font"
                    value={brandingForm.font}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, font: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-radius" className="block text-sm font-medium text-gray-700 mb-1">
                    Eckenradius
                  </label>
                  <input
                    type="text"
                    id="edit-radius"
                    value={brandingForm.radius}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, radius: e.target.value }))}
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Vorschau</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <div
                    className="rounded-lg p-4 text-white"
                    style={{
                      backgroundColor: brandingForm.primary,
                      borderRadius: brandingForm.radius,
                      fontFamily: brandingForm.font,
                    }}
                  >
                    <p className="text-sm font-medium">Primär-Karte</p>
                    <p className="text-xs opacity-80 mt-1">Beispielinhalt</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-medium text-white"
                      style={{
                        backgroundColor: brandingForm.primary,
                        borderRadius: brandingForm.radius,
                      }}
                    >
                      Primär-Button
                    </button>
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-white rounded-full"
                      style={{ backgroundColor: brandingForm.accent }}
                    >
                      Akzent-Badge
                    </span>
                  </div>
                  <div
                    className="rounded-lg border border-gray-200 bg-white p-3"
                    style={{ borderRadius: brandingForm.radius, fontFamily: brandingForm.font }}
                  >
                    <p className="text-sm font-medium" style={{ color: brandingForm.secondary }}>
                      Sekundärtext
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Schrift: {brandingForm.font} | Radius: {brandingForm.radius}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={brandingSaving}
                onClick={handleBrandingSave}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {brandingSaving ? 'Speichern...' : 'Branding speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impersonation dialog (modal overlay) */}
      {impersonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Als Benutzer anmelden
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Impersonation von <strong>{impersonation.userName}</strong>. Dieser Vorgang wird im Audit-Log protokolliert.
            </p>

            {impersonation.error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {impersonation.error}
              </div>
            )}

            {impersonation.result ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Impersonation-Session erstellt
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-green-700 mb-0.5">Token</label>
                      <code className="block w-full rounded border border-green-300 bg-white px-3 py-1.5 text-xs font-mono text-gray-900 select-all">
                        {impersonation.result.token}
                      </code>
                    </div>
                    <div>
                      <label className="block text-xs text-green-700 mb-0.5">Gültig bis</label>
                      <p className="text-sm text-green-800">
                        {new Date(impersonation.result.expiresAt).toLocaleString('de-CH')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-green-700 mb-0.5">Impersonation-Link</label>
                      <code className="block w-full rounded border border-green-300 bg-white px-3 py-1.5 text-xs font-mono text-gray-900 select-all break-all">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/auth/impersonate?token=${impersonation.result.token}`
                          : `/auth/impersonate?token=${impersonation.result.token}`}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setImpersonation(null)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="impersonate-reason" className="block text-sm font-medium text-gray-700 mb-1">
                    Grund der Impersonation *
                  </label>
                  <textarea
                    id="impersonate-reason"
                    rows={3}
                    value={impersonation.reason}
                    onChange={(e) =>
                      setImpersonation((prev) =>
                        prev ? { ...prev, reason: e.target.value } : null,
                      )
                    }
                    placeholder="z.B. Support-Anfrage #1234, Fehlerbehebung..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <svg className="h-5 w-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-yellow-700">
                    Die Session ist 30 Minuten gültig. Alle Aktionen werden im Audit-Log unter Ihrem Admin-Account protokolliert.
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setImpersonation(null)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    disabled={impersonation.loading || !impersonation.reason.trim()}
                    onClick={handleImpersonate}
                    className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {impersonation.loading ? 'Erstelle Session...' : 'Session erstellen'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Rollen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    2FA
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Erstellt
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Letzter Login
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      Keine Benutzer in diesem Unternehmen.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const initials = [user.firstName, user.lastName]
                      .filter(Boolean)
                      .map((n) => n!.charAt(0).toUpperCase())
                      .join('')

                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                              {initials || '??'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{user.displayName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              user.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.isActive ? 'Aktiv' : 'Deaktiviert'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              user.totpEnabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {user.totpEnabled ? 'Aktiv' : 'Ausstehend'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {user.lastSignInAt ? formatDate(user.lastSignInAt) : 'Noch nie'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setImpersonation({
                                userId: user.id,
                                userName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.displayName,
                                reason: '',
                                loading: false,
                                result: null,
                                error: null,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2.5 py-1.5 text-xs font-medium text-yellow-800 border border-yellow-200 hover:bg-yellow-100 transition-colors"
                            aria-label={`Als ${user.firstName} ${user.lastName} anmelden`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            Als Benutzer anmelden
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
