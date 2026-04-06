/**
 * User login page.
 *
 * Provides email/password authentication with client-side validation
 * and inline error display. Redirects to the home page on success.
 */

import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReCAPTCHA from 'react-google-recaptcha';

import { useAuth } from '../hooks/useAuth';
import logger from '../services/logger';
import styles from './LoginPage.module.css';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as
  | string
  | undefined;

/** Field-level validation errors. */
interface FieldErrors {
  email?: string;
  password?: string;
}

/**
 * Validates login form fields and returns any errors found.
 */
function validateFields(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

/**
 * Extracts a user-friendly message from an API error response.
 */
function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data?.error;
    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError;
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Renders the login form for user authentication.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const captchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Handle form submission. */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);

    const errors = validateFields(email, password);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const signedInUser = await login(email, password, captchaToken ?? '');
      if (signedInUser.role === 'business_owner') {
        navigate('/owner/dashboard', { replace: true });
        return;
      }
      if (signedInUser.role === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = extractApiError(err);
      setApiError(message);
      logger.error('Login failed:', message);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.backdrop} />
      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <p className={styles.railLabel}>Sign in</p>
          <h1 className={styles.railTitle}>Welcome back to Circa</h1>
          <p className={styles.railText}>
            One login works for everyone. We’ll route you to your correct experience after sign in.
          </p>

          <div className={styles.railLinks}>
            <p>
              New user account? <Link className={styles.footerLink} to="/register">Register as user</Link>
            </p>
            <p>
              New owner account?{' '}
              <Link className={styles.footerLink} to="/business-register">
                Register as business owner
              </Link>
            </p>
          </div>
        </aside>

        <div className={styles.card}>
          <h2 className={styles.title}>Login</h2>
          <p className={styles.subtitle}>Enter your account credentials</p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {apiError && <div className={styles.apiError}>{apiError}</div>}

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email && (
                <span className={styles.fieldError}>{fieldErrors.email}</span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
              <div className={styles.passwordRow}>
                <input
                  id="login-password"
                  className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password && (
                <span className={styles.fieldError}>{fieldErrors.password}</span>
              )}
            </div>

            {RECAPTCHA_SITE_KEY ? (
              <div className={styles.captchaWrapper}>
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={(token) => setCaptchaToken(token)}
                  onExpired={() => setCaptchaToken(null)}
                />
              </div>
            ) : (
              <p className={styles.captchaNote}>
                reCAPTCHA not configured - login will proceed without verification.
              </p>
            )}

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
