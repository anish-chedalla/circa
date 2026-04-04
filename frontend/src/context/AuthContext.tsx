/**
 * React context that manages authentication state for the entire app.
 *
 * Provides `user`, `token`, `loading`, `login`, `register`, and `logout`
 * to any descendant component via the `useAuth` hook.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { get, post } from '../services/api';
import logger from '../services/logger';
import type { User } from '../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  /** Authenticate with email + password and persist the JWT. */
  login: (email: string, password: string) => Promise<void>;
  /** Register a new account (with reCAPTCHA token) and persist the JWT. */
  register: (email: string, password: string, captchaToken: string) => Promise<void>;
  /** Clear the session and remove the stored JWT. */
  logout: () => void;
}

interface AuthTokenResponse {
  data: { token: string; user: User } | null;
  error: string | null;
}

interface MeResponse {
  data: User | null;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Wraps the component tree with authentication state and helpers.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    loading: true,
  });

  /* ---------- validate stored token on mount ---------------------- */
  useEffect(() => {
    const storedToken = localStorage.getItem('token');

    if (!storedToken) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    get<MeResponse>('/auth/me')
      .then((resp) => {
        if (!resp.data) throw new Error('No user data');
        setState({ user: resp.data, token: storedToken, loading: false });
      })
      .catch(() => {
        logger.warn('Stored token invalid – clearing session');
        localStorage.removeItem('token');
        setState({ user: null, token: null, loading: false });
      });
  }, []);

  /* ---------- login ----------------------------------------------- */
  const login = useCallback(async (email: string, password: string) => {
    const resp = await post<AuthTokenResponse>('/auth/login', { email, password });
    if (resp.error || !resp.data) throw new Error(resp.error ?? 'Login failed');
    const { token, user } = resp.data;
    localStorage.setItem('token', token);
    setState({ user, token, loading: false });
    logger.info('User logged in', user.email);
  }, []);

  /* ---------- register -------------------------------------------- */
  const register = useCallback(
    async (email: string, password: string, captchaToken: string) => {
      const resp = await post<AuthTokenResponse>('/auth/register', {
        email,
        password,
        captcha_token: captchaToken,
      });
      if (resp.error || !resp.data) throw new Error(resp.error ?? 'Registration failed');
      const { token, user } = resp.data;
      localStorage.setItem('token', token);
      setState({ user, token, loading: false });
      logger.info('User registered', user.email);
    },
    [],
  );

  /* ---------- logout ---------------------------------------------- */
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setState({ user: null, token: null, loading: false });
    logger.info('User logged out');
  }, []);

  /* ---------- memoised context value ------------------------------ */
  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
