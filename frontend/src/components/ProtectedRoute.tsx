/**
 * Route guard that restricts access to authenticated users.
 *
 * Optionally checks for a specific role. Admins always pass role checks.
 * Redirects to /login when unauthenticated, or / when role is insufficient.
 */

import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If provided, the user's role must match this value (admins bypass this check). */
  requiredRole?: string;
}

/**
 * Wrap page-level components to enforce authentication and optional role checks.
 */
export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  // Admins can access any protected page regardless of requiredRole
  const roleOk = !requiredRole || user.role === requiredRole || user.role === 'admin';
  if (!roleOk) return <Navigate to="/" replace />;

  return <>{children}</>;
}
