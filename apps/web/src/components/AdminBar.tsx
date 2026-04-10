'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  label: string
  href: string
}

type AdminBarProps = {
  variant: 'super-user' | 'holding-admin'
  label: string
  items: NavItem[]
}

const VARIANT_STYLES = {
  'super-user': {
    bg: 'var(--brand-primary, #1A56DB)',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.7)',
    activeBg: 'rgba(255,255,255,0.2)',
    hoverBg: 'rgba(255,255,255,0.1)',
  },
  'holding-admin': {
    bg: '#1E3A5F',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.65)',
    activeBg: 'rgba(255,255,255,0.2)',
    hoverBg: 'rgba(255,255,255,0.1)',
  },
}

export function AdminBar({ variant, label, items }: AdminBarProps) {
  const pathname = usePathname()
  const styles = VARIANT_STYLES[variant]

  return (
    <div
      className="flex h-10 items-center justify-between px-4 text-xs"
      style={{ backgroundColor: styles.bg, color: styles.text }}
    >
      {/* Left: label + nav */}
      <div className="flex items-center gap-5">
        <span className="font-semibold truncate max-w-[160px]">{label}</span>

        <nav className="hidden sm:flex items-center gap-0.5">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-2.5 py-1 rounded font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? styles.activeBg : 'transparent',
                  color: isActive ? styles.text : styles.textMuted,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = styles.hoverBg
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Right: back link */}
      <Link
        href="/dashboard"
        className="transition-colors"
        style={{ color: styles.textMuted }}
        onMouseEnter={(e) => { e.currentTarget.style.color = styles.text }}
        onMouseLeave={(e) => { e.currentTarget.style.color = styles.textMuted }}
      >
        ← Dashboard
      </Link>
    </div>
  )
}
