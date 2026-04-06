import React from 'react'

import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'

export interface SidebarItem {
  key: string
  label: string
  href: string
  icon: IconName
  active?: boolean
}

export interface SidebarUser {
  name: string
  role: string
}

export interface SidebarProps {
  logo: React.ReactNode
  items: SidebarItem[]
  user: SidebarUser
  collapsed: boolean
  onToggleCollapse: () => void
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const Sidebar: React.FC<SidebarProps> = ({
  logo,
  items,
  user,
  collapsed,
  onToggleCollapse,
  children,
  className,
  style,
}) => {
  const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: collapsed ? '64px' : '240px',
    minHeight: '100vh',
    backgroundColor: 'var(--brand-surface)',
    borderRight: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
    transition: 'width 200ms ease',
    overflow: 'hidden',
    fontFamily: 'var(--brand-font, inherit)',
    flexShrink: 0,
    ...style,
  }

  const logoContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'space-between',
    padding: collapsed ? '16px 8px' : '16px 16px',
    borderBottom: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
    minHeight: '60px',
  }

  const collapseButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: 'var(--brand-radius, 8px)',
    color: 'var(--brand-text-secondary)',
    flexShrink: 0,
    padding: 0,
  }

  const navStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px',
    overflowY: 'auto',
    overflowX: 'hidden',
  }

  const userSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: collapsed ? '12px 8px' : '12px 16px',
    borderTop: '1px solid color-mix(in srgb, var(--brand-text-secondary) 20%, transparent)',
    justifyContent: collapsed ? 'center' : 'flex-start',
  }

  return (
    <nav className={className} style={sidebarStyle} aria-label="Main navigation">
      <div style={logoContainerStyle}>
        {collapsed ? null : <div style={{ overflow: 'hidden', flexShrink: 1 }}>{logo}</div>}
        <button
          style={collapseButtonStyle}
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          type="button"
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={18} />
        </button>
      </div>

      <div style={navStyle} role="list">
        {items.map((item) => {
          const itemStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '10px' : '10px 12px',
            borderRadius: 'var(--brand-radius, 8px)',
            textDecoration: 'none',
            color: item.active ? 'var(--brand-primary)' : 'var(--brand-text-primary)',
            backgroundColor: item.active
              ? 'color-mix(in srgb, var(--brand-primary) 10%, transparent)'
              : 'transparent',
            fontWeight: item.active ? 600 : 400,
            fontSize: '14px',
            lineHeight: '20px',
            cursor: 'pointer',
            border: 'none',
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'background-color 150ms ease',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }

          return (
            <a key={item.key} href={item.href} style={itemStyle} role="listitem" aria-current={item.active ? 'page' : undefined}>
              <Icon name={item.icon} size={20} />
              {collapsed ? null : <span>{item.label}</span>}
            </a>
          )
        })}
      </div>

      {children}

      <div style={userSectionStyle}>
        <Avatar name={user.name} size="sm" />
        {collapsed ? null : (
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--brand-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--brand-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user.role}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Sidebar
