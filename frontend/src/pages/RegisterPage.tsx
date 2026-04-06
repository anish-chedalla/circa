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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateFields(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!displayName.trim()) {
    errors.displayName = 'Display name is required.';
  } else if (displayName.trim().length > 120) {
    errors.displayName = 'Display name must be 120 characters or fewer.';
  }

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

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const captchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);

    const errors = validateFields(displayName, email, password, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await register(email, displayName.trim(), password, captchaToken ?? '');
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
      <div className={styles.backdrop} />
      <div className={styles.layout}>
        <aside className={styles.leftRail}>
          <p className={styles.railLabel}>User account</p>
          <h1 className={styles.railTitle}>Create your Circa account</h1>
          <p className={styles.railText}>
            Join to discover and support local businesses around your community.
          </p>
          <div className={styles.railLinks}>
            <p>
              Already have an account?{' '}
              <Link className={styles.footerLink} to="/login">
                Login
              </Link>
            </p>
            <p>
              Need an owner account?{' '}
              <Link className={styles.footerLink} to="/business-register">
                Business owner register
              </Link>
            </p>
          </div>
        </aside>

        <div className={styles.card}>
          <h2 className={styles.title}>Register as user</h2>
          <p className={styles.subtitle}>Create your account credentials</p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {apiError && <div className={styles.apiError}>{apiError}</div>}

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="register-display-name">
                Display Name
              </label>
              <input
                id="register-display-name"
                className={`${styles.input} ${fieldErrors.displayName ? styles.inputError : ''}`}
                type="text"
                placeholder="Your name"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              {fieldErrors.displayName && <span className={styles.fieldError}>{fieldErrors.displayName}</span>}
            </div>

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
              {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="register-password">
                Password
              </label>
              <div className={styles.passwordRow}>
                <input
                  id="register-password"
                  className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 chars, at least one digit"
                  autoComplete="new-password"
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
              {fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="register-confirm">
                Confirm Password
              </label>
              <div className={styles.passwordRow}>
                <input
                  id="register-confirm"
                  className={`${styles.input} ${fieldErrors.confirmPassword ? styles.inputError : ''}`}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <span className={styles.fieldError}>{fieldErrors.confirmPassword}</span>
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
                reCAPTCHA not configured - registration will proceed without verification.
              </p>
            )}

            <button className={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
