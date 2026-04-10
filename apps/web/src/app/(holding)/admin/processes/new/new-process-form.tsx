'use client'

import { useFormState } from 'react-dom'
import { useState } from 'react'
import Link from 'next/link'
import { createProcessAction, type CreateProcessResult } from './actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: 'verkauf', label: 'Verkauf' },
  { value: 'planung', label: 'Planung' },
  { value: 'abwicklung', label: 'Abwicklung' },
  { value: 'betrieb', label: 'Betrieb' },
  { value: 'sonstige', label: 'Sonstige' },
] as const

const ALL_ROLES = [
  { key: 'super_user', label: 'Super User' },
  { key: 'geschaeftsfuehrung', label: 'Geschäftsführung' },
  { key: 'teamleiter', label: 'Teamleiter' },
  { key: 'setter', label: 'Setter' },
  { key: 'berater', label: 'Berater' },
  { key: 'innendienst', label: 'Innendienst' },
  { key: 'bau', label: 'Bau / Montage' },
  { key: 'buchhaltung', label: 'Buchhaltung' },
  { key: 'leadkontrolle', label: 'Leadkontrolle' },
] as const

const MENU_ICONS = [
  'clipboard',
  'chart-bar',
  'cog',
  'currency-dollar',
  'phone',
  'users',
  'folder',
  'document',
  'calendar',
  'truck',
] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CompanyOption {
  id: string
  name: string
}

interface TemplateOption {
  id: string
  name: string
  category: string
  description: string | null
}

interface NewProcessFormProps {
  companies: CompanyOption[]
  templates: TemplateOption[]
  preselectedCompanyId: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const initialState: CreateProcessResult = {}

export function NewProcessForm({
  companies,
  templates,
  preselectedCompanyId,
}: NewProcessFormProps) {
  const [state, formAction] = useFormState(
    async (_prev: CreateProcessResult, fd: FormData) => createProcessAction(fd),
    initialState,
  )

  const [useTemplate, setUseTemplate] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['geschaeftsfuehrung'])

  const toggleRole = (roleKey: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey],
    )
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {/* Global error */}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Company selector */}
      <div>
        <label htmlFor="companyId" className="block text-sm font-medium text-gray-700 mb-1">
          Unternehmen
        </label>
        <select
          id="companyId"
          name="companyId"
          defaultValue={preselectedCompanyId ?? ''}
          required
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        >
          <option value="" disabled>
            Unternehmen auswählen...
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.companyId && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.companyId}</p>
        )}
      </div>

      {/* Process name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Prozessname
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="z.B. Verkaufsprozess PV-Anlage"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Kategorie
        </label>
        <select
          id="category"
          name="category"
          required
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        >
          <option value="" disabled>
            Kategorie wählen...
          </option>
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.category && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.category}</p>
        )}
      </div>

      {/* Menu label */}
      <div>
        <label htmlFor="menuLabel" className="block text-sm font-medium text-gray-700 mb-1">
          Menuelabel
        </label>
        <input
          id="menuLabel"
          name="menuLabel"
          type="text"
          required
          placeholder="z.B. PV-Verkauf"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
        {state.fieldErrors?.menuLabel && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.menuLabel}</p>
        )}
      </div>

      {/* Menu icon */}
      <div>
        <label htmlFor="menuIcon" className="block text-sm font-medium text-gray-700 mb-1">
          Menueicon
        </label>
        <select
          id="menuIcon"
          name="menuIcon"
          defaultValue="clipboard"
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        >
          {MENU_ICONS.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </select>
      </div>

      {/* Visible roles */}
      <div>
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">
            Sichtbar für Rollen
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_ROLES.map((role) => (
              <label
                key={role.key}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  name="visibleRoles"
                  value={role.key}
                  checked={selectedRoles.includes(role.key)}
                  onChange={() => toggleRole(role.key)}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                />
                <span className="text-gray-700">{role.label}</span>
              </label>
            ))}
          </div>
          {state.fieldErrors?.visibleRoles && (
            <p className="mt-1 text-sm text-red-600">{state.fieldErrors.visibleRoles}</p>
          )}
        </fieldset>
      </div>

      {/* Template toggle */}
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={() => setUseTemplate(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !useTemplate
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Leerer Prozess
          </button>
          <button
            type="button"
            onClick={() => setUseTemplate(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              useTemplate
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Von Vorlage starten
          </button>
        </div>

        {useTemplate && (
          <div>
            <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-1">
              Vorlage
            </label>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-500">Keine Vorlagen verfügbar.</p>
            ) : (
              <select
                id="templateId"
                name="templateId"
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              >
                <option value="">Vorlage wählen...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!useTemplate && (
          <input type="hidden" name="templateId" value="" />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Prozess erstellen
        </button>
        <Link
          href="/admin/processes"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Abbrechen
        </Link>
      </div>
    </form>
  )
}
