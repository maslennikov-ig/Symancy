import { useState } from 'react'
import { Menu } from 'lucide-react'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  userName?: string
  userEmail?: string
  userAvatar?: string
  onLogout?: () => void
}

export function AdminLayout({
  children,
  title = 'Dashboard',
  userName,
  userEmail,
  userAvatar,
  onLogout,
}: AdminLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900">
      {/* Mobile menu button - only visible on mobile */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-white md:hidden"
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Sidebar with mobile support */}
      <AdminSidebar
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content - responsive padding */}
      <div className="md:pl-64">
        {/* Header */}
        <AdminHeader
          title={title}
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
          onLogout={onLogout}
        />

        {/* Page Content - extra top padding on mobile for menu button */}
        <main className="p-4 pt-16 md:p-6 md:pt-6">{children}</main>
      </div>
    </div>
  )
}
