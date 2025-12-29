import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  Settings,
  Users,
  MessageSquare,
  DollarSign,
  Activity,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/system-config', label: 'System Config', icon: Settings },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/costs', label: 'Costs', icon: DollarSign },
  { to: '/admin/user-states', label: 'User States', icon: Activity },
]

interface AdminSidebarProps {
  isMobileOpen?: boolean
  onClose?: () => void
}

export function AdminSidebar({
  isMobileOpen = false,
  onClose,
}: AdminSidebarProps) {
  return (
    <>
      {/* Backdrop overlay - only on mobile when menu is open */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-slate-900 text-white',
          'transition-transform duration-300 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        {/* Close button on mobile */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded text-slate-400 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo */}
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          <span className="text-xl font-bold tracking-tight">
            Symancy Admin
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin/dashboard'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Version - dynamically imported from package.json */}
        <div className="border-t border-slate-800 px-6 py-4">
          <span className="text-xs text-slate-500">v{__APP_VERSION__}</span>
        </div>
      </aside>
    </>
  )
}
