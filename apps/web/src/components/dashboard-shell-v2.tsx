'use client'

import { useState } from 'react'
import { SidebarNav } from './sidebar-nav'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectorInfo = {
  name: string
  status: 'connected' | 'warning' | 'disconnected'
}

type DashboardShellV2Props = {
  companyName: string
  userName: string
  userEmail: string
  userRole: string
  isHoldingAdmin?: boolean
  isSuperUser?: boolean
  connectors?: ConnectorInfo[]
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardShellV2({
  companyName,
  userName,
  userEmail,
  userRole,
  isHoldingAdmin = false,
  isSuperUser = false,
  connectors = [],
  children,
}: DashboardShellV2Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-brand-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Escape') setSidebarOpen(false) }}
          aria-label="Sidebar schliessen"
        />
      )}

      {/* Sidebar */}
      <div className={sidebarOpen ? '[&>.sidebar-nav]:sidebar-open' : ''}>
        <SidebarNav
          companyName={companyName}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
          isHoldingAdmin={isHoldingAdmin}
          isSuperUser={isSuperUser}
          connectors={connectors}
        />
      </div>

      {/* Main content area */}
      <div className="main-with-sidebar min-h-screen">
        {/* Mobile header */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-text-secondary hover:bg-gray-100"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-brand-text-primary">{companyName}</span>
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  )
}
