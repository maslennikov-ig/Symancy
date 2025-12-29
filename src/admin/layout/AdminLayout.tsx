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
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <div className="pl-64">
        {/* Header */}
        <AdminHeader
          title={title}
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
          onLogout={onLogout}
        />

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
