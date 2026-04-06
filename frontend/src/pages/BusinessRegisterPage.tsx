import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import axios from 'axios';

import { useAuth } from '../hooks/useAuth';
import logger from '../services/logger';
import styles from './BusinessRegisterPage.module.css';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFields(
  displayName: string,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!displayName.trim()) errors.displayName = 'Display name is required.';
  else if (displayName.trim().length > 120) errors.displayName = 'Display name must be 120 characters or fewer.';
  if (!email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_REGEX.test(email)) errors.email = 'Please enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length < 8 || !/\d/.test(password)) {
    errors.password = 'Password must be at least 8 characters and include one digit.';
  }
  if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data?.error;
    if (typeof apiError === 'string' && apiError.trim()) {
      return apiError;
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    return 'Unable to create business account.';
  }
  return 'Unable to create business account.';
}

export default function BusinessRegisterPage() {
  const { registerBusiness } = useAuth();
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
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');
    const errors = validateFields(displayName, email, password, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await registerBusiness(email, displayName.trim(), password, captchaToken ?? '');
      navigate('/owner/new-listing', { replace: true });
    } catch (err) {
      const message = extractApiError(err);
      setApiError(message);
      logger.error('Business owner registration failed:', message);
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
          <p className={styles.railLabel}>Owner account</p>
          <h1 className={styles.railTitle}>Register your business access</h1>
          <p className={styles.railText}>
            Create an owner account to submit listings and manage your business dashboard.
          </p>
          <div className={styles.railLinks}>
            <p>
              Already have an owner account? <Link to="/login">Login</Link>
            </p>
            <p>
              Need a standard user account? <Link to="/register">User register</Link>
            </p>
          </div>
        </aside>

        <div className={styles.card}>
          <h2 className={styles.title}>Register as business owner</h2>
          <p className={styles.subtitle}>Submit your listing for admin approval.</p>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            {apiError && <p className={styles.apiError}>{apiError}</p>}

            <label className={styles.label}>
              Display Name
              <input
                className={styles.input}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
              {fieldErrors.displayName && <span className={styles.fieldError}>{fieldErrors.displayName}</span>}
            </label>

            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
              />
              {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
            </label>

            <label className={styles.label}>
              Password
              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters and 1 digit"
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
            </label>

            <label className={styles.label}>
              Confirm Password
              <div className={styles.passwordRow}>
                <input
                  className={styles.input}
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
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
            </label>

            {RECAPTCHA_SITE_KEY ? (
              <div className={styles.captchaWrap}>
                <ReCAPTCHA
                  ref={captchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={(token) => setCaptchaToken(token)}
                  onExpired={() => setCaptchaToken(null)}
                />
              </div>
            ) : (
              <p className={styles.note}>reCAPTCHA not configured.</p>
            )}

            <button className={styles.submitBtn} type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create business account'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
