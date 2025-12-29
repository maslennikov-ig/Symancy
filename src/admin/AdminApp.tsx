import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router';
import { useAdminAuth } from './hooks/useAdminAuth';
import { LoaderIcon } from '../components/icons/LoaderIcon';

// Lazy-loaded admin pages (placeholder components for now)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SystemConfigPage = lazy(() => import('./pages/SystemConfigPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const UserDetailPage = lazy(() => import('./pages/UserDetailPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const CostsPage = lazy(() => import('./pages/CostsPage'));
const UserStatesPage = lazy(() => import('./pages/UserStatesPage'));

/**
 * Loading spinner component for admin pages
 */
function AdminLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoaderIcon className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * 403 Forbidden page for non-admin users
 */
function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
      <h1 className="text-6xl font-bold text-destructive mb-4">403</h1>
      <h2 className="text-2xl font-semibold mb-2">Access Forbidden</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        You do not have permission to access the admin panel.
        Please contact an administrator if you believe this is an error.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Return to Home
      </Link>
    </div>
  );
}

/**
 * Protected route wrapper for admin pages
 */
function ProtectedAdminRoutes() {
  const { isAdmin, isLoading, user } = useAdminAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return <AdminLoadingFallback />;
  }

  // Redirect to login if not logged in
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Show 403 if logged in but not admin
  if (!isAdmin) {
    return <ForbiddenPage />;
  }

  // Render protected admin routes
  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <Routes>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="system-config" element={<SystemConfigPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="costs" element={<CostsPage />} />
        <Route path="user-states" element={<UserStatesPage />} />
        {/* Catch-all redirect to dashboard */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Main Admin App component
 * Entry point for all /admin/* routes
 */
export function AdminApp() {
  const { isLoading, user } = useAdminAuth();

  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <Routes>
        {/* Login page is always accessible */}
        <Route
          path="login"
          element={
            // If already logged in as admin, redirect to dashboard
            !isLoading && user ? (
              <Navigate to="/admin/dashboard" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        {/* All other admin routes are protected */}
        <Route path="*" element={<ProtectedAdminRoutes />} />
      </Routes>
    </Suspense>
  );
}

export default AdminApp;
