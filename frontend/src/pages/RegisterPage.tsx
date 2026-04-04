/**
 * User registration page.
 *
 * Provides email/password sign-up with client-side validation,
 * Google reCAPTCHA v2, and inline error display. Redirects to the
 * home page on successful registration.
 */

import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReCAPTCHA from 'react-google-recaptcha';

import { useAuth } from '../hooks/useAuth';
import logger from '../services/logger';
import styles from './RegisterPage.module.css';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as
  | string
  | undefined;

/** Email regex pattern for basic format validation. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-level validation errors. */
interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Validates registration form fields and returns any errors found.
 */
function validateFields(
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  } else if (!/\d/.test(password)) {
    errors.password = 'Password must contain at least one digit.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
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
 * Renders the registration form for new user sign-up.
 */
export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const captchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Handle form submission. */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);

    const errors = validateFields(email, password, confirmPassword);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      await register(email, password, captchaToken ?? '');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = extractApiError(err);
      setApiError(message);
      logger.error('Registration failed:', message);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.subtitle}>
          Join to discover local businesses near you
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {apiError && <div className={styles.apiError}>{apiError}</div>}

          {/* Email */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-email">
              Email
            </label>
            <input
              id="register-email"
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

          {/* Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              type="password"
              placeholder="Min 8 chars, at least one digit"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErrors.password && (
              <span className={styles.fieldError}>{fieldErrors.password}</span>
            )}
          </div>

          {/* Confirm Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-confirm">
              Confirm Password
            </label>
            <input
              id="register-confirm"
              className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
              type="password"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {fieldErrors.confirmPassword && (
              <span className={styles.fieldError}>
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          {/* reCAPTCHA */}
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
              reCAPTCHA not configured — registration will proceed without
              verification.
            </p>
          )}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link className={styles.footerLink} to="/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
