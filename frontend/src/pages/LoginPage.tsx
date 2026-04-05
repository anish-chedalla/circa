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
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
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
      await login(email, password, captchaToken ?? '');
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
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your account</p>

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
            <input
              id="login-password"
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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

        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link className={styles.footerLink} to="/register">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
