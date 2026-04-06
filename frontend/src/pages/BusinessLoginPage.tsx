import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import axios from 'axios';

import { useAuth } from '../hooks/useAuth';
import logger from '../services/logger';
import styles from './BusinessLoginPage.module.css';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error ?? error.response?.data?.detail ?? 'Unable to sign in.';
  }
  return 'Unable to sign in.';
}

export default function BusinessLoginPage() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const captchaRef = useRef<ReCAPTCHA | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError('');
    setSubmitting(true);
    try {
      const user = await login(email, password, captchaToken ?? '');
      if (user.role !== 'business_owner' && user.role !== 'admin') {
        logout();
        setApiError('This login is only for business-owner accounts.');
        return;
      }
      navigate('/owner/new-listing', { replace: true });
    } catch (err) {
      const message = extractApiError(err);
      setApiError(message);
      logger.error('Business login failed:', message);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Business login</h1>
        <p className={styles.subtitle}>Sign in to submit or manage your business listing.</p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {apiError && <p className={styles.apiError}>{apiError}</p>}

          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
            {submitting ? 'Signing in...' : 'Business sign in'}
          </button>
        </form>

        <p className={styles.footer}>
          Need an owner account? <Link to="/business-register">Create business account</Link>
        </p>

        <p className={styles.footer}>
          Trying to login as user? <Link to="/login">User login page</Link>
        </p>
      </div>
    </div>
  );
}
