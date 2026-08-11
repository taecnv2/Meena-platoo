import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, X } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { useAuth } from '@/features/auth/AuthContext'
import { NAV_GROUPS, NAV_STANDALONE } from '@/constants/nav'
import { cn } from '@/utils/cn'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const permissions = new Set(user?.permissions ?? [])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        next.delete(label)
      } else {
        next.add(label)
      }
      return next
    })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-primary-light text-primary' : 'text-text-primary hover:bg-slate-100',
    )

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      <div className="mb-4 px-2">
        <BrandLogo variant="sidebar" />
      </div>
      {user?.isSuperScope || permissions.has(NAV_STANDALONE.permission) ? (
        <NavLink to={NAV_STANDALONE.path} className={linkClass} onClick={onNavigate}>
          <NAV_STANDALONE.icon className="size-4 shrink-0" />
          {NAV_STANDALONE.label}
        </NavLink>
      ) : null}
      {NAV_GROUPS.map((group, index) => {
        const items = group.items.filter((item) => user?.isSuperScope || permissions.has(item.permission))
        if (items.length === 0) {
          return null
        }
        const isExpanded = !collapsedGroups.has(group.label)
        return (
          <div key={group.label} className={cn('mt-3', index > 0 && 'border-t border-border pt-3')}>
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={isExpanded}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-slate-100"
            >
              <group.icon className="size-4 shrink-0 text-text-secondary" />
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown
                className={cn('size-4 shrink-0 text-text-secondary transition-transform', !isExpanded && '-rotate-90')}
              />
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-in-out"
              style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 py-1 pl-3">
                  {items.map((item) => (
                    <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  const handleLogout = () => {
    void logout().then(() => navigate('/login'))
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white lg:block">
        <SidebarContent />
      </aside>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileNavOpen(false)} />
          <div className="relative flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-text-secondary hover:bg-slate-100"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="ปิดเมนู"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setIsMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-text-secondary hover:bg-slate-100 lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="เปิดเมนู"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <BrandLogo variant="mobile" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-text-primary">{user?.username}</p>
              <p className="text-xs text-text-secondary">{user?.roleName}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-slate-100"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
