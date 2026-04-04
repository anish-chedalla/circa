/**
 * Root application component.
 *
 * Sets up React Router routes with lazy-loaded pages and wraps
 * the tree in the AuthProvider context.
 */

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingSpinner from './components/LoadingSpinner';

import { AuthProvider } from './context/AuthContext';
import { NavbarSlotProvider } from './context/NavbarSlotContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded page components                                       */
/* ------------------------------------------------------------------ */

const MapDiscovery = lazy(() => import('./pages/MapDiscovery'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const BusinessDetail = lazy(() => import('./pages/BusinessDetail'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const ClaimBusiness = lazy(() => import('./pages/ClaimBusiness'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

/* ------------------------------------------------------------------ */
/*  Fallback spinner for Suspense                                     */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/*  App                                                               */
/* ------------------------------------------------------------------ */

/**
 * Top-level component that composes providers, navigation, and routes.
 */
export default function App() {
  return (
    <NavbarSlotProvider>
    <AuthProvider>
      <Navbar />
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<MapDiscovery />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/business/:id" element={<BusinessDetail />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/owner/dashboard"
            element={
              <ProtectedRoute requiredRole="business_owner">
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/claim"
            element={
              <ProtectedRoute>
                <ClaimBusiness />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AuthProvider>
    </NavbarSlotProvider>
  );
}
