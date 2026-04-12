'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface TeamMember {
  id: string
  display_name: string
}

interface Props {
  members: TeamMember[]
  paramName?: string
  label?: string
}

export function TeamMemberFilter({ members, paramName = 'member', label = 'Mitarbeiter' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selected = searchParams.get(paramName) ?? ''

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(paramName, value)
    } else {
      params.delete(paramName)
    }
    router.push(`?${params.toString()}`)
  }

  if (members.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="team-member-filter" className="text-sm text-gray-500 whitespace-nowrap">
        {label}:
      </label>
      <select
        id="team-member-filter"
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900"
      >
        <option value="">Alle</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>
    </div>
  )
}
