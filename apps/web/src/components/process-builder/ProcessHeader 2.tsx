'use client'

import type { ProcessDefinitionRow } from '@enura/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: Array<{ value: ProcessDefinitionRow['category']; label: string }> = [
  { value: 'verkauf', label: 'Verkauf' },
  { value: 'planung', label: 'Planung' },
  { value: 'abwicklung', label: 'Abwicklung' },
  { value: 'betrieb', label: 'Betrieb' },
  { value: 'sonstige', label: 'Sonstige' },
]

const ALL_ROLES = [
  { key: 'super_user', label: 'Super User' },
  { key: 'geschaeftsfuehrung', label: 'Geschaeftsfuehrung' },
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

interface ProcessHeaderProps {
  name: string
  category: ProcessDefinitionRow['category']
  menuLabel: string
  menuIcon: string
  visibleRoles: string[]
  onNameChange: (val: string) => void
  onCategoryChange: (val: ProcessDefinitionRow['category']) => void
  onMenuLabelChange: (val: string) => void
  onMenuIconChange: (val: string) => void
  onVisibleRolesChange: (val: string[]) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessHeader({
  name,
  category,
  menuLabel,
  menuIcon,
  visibleRoles,
  onNameChange,
  onCategoryChange,
  onMenuLabelChange,
  onMenuIconChange,
  onVisibleRolesChange,
}: ProcessHeaderProps) {
  const toggleRole = (roleKey: string) => {
    if (visibleRoles.includes(roleKey)) {
      onVisibleRolesChange(visibleRoles.filter((r) => r !== roleKey))
    } else {
      onVisibleRolesChange([...visibleRoles, roleKey])
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
        Prozess-Einstellungen
      </h2>

      {/* Name */}
      <div>
        <label htmlFor="proc-name" className="block text-sm font-medium text-gray-600 mb-1">
          Prozessname
        </label>
        <input
          id="proc-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="proc-category" className="block text-sm font-medium text-gray-600 mb-1">
          Kategorie
        </label>
        <select
          id="proc-category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as ProcessDefinitionRow['category'])}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Menu label */}
      <div>
        <label htmlFor="proc-menu-label" className="block text-sm font-medium text-gray-600 mb-1">
          Menuelabel
        </label>
        <input
          id="proc-menu-label"
          type="text"
          value={menuLabel}
          onChange={(e) => onMenuLabelChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      {/* Menu icon */}
      <div>
        <label htmlFor="proc-menu-icon" className="block text-sm font-medium text-gray-600 mb-1">
          Menueicon
        </label>
        <select
          id="proc-menu-icon"
          value={menuIcon}
          onChange={(e) => onMenuIconChange(e.target.value)}
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
        <p className="block text-sm font-medium text-gray-600 mb-2">Sichtbar fuer Rollen</p>
        <div className="space-y-1">
          {ALL_ROLES.map((role) => (
            <label
              key={role.key}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <input
                type="checkbox"
                checked={visibleRoles.includes(role.key)}
                onChange={() => toggleRole(role.key)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <span className="text-gray-700">{role.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
