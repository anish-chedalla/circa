/**
 * Custom hook that returns the current authentication context.
 *
 * Must be used inside an `<AuthProvider>` — throws an error otherwise.
 */

import { useContext } from 'react';

import { AuthContext } from '../context/AuthContext';

/**
 * Retrieve the authentication state and helpers from `AuthContext`.
 *
 * @throws {Error} When called outside of an `<AuthProvider>`.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
