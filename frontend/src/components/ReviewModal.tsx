/**
 * Modal for submitting or editing a business review.
 * Includes a star picker, text area, reCAPTCHA, and validation.
 */

import { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

import { post } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse, Review } from '../types';
import styles from './ReviewModal.module.css';

interface ReviewModalProps {
  businessId: number;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
  existingReview?: Review;
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

/**
 * Renders a modal dialog for writing or editing a business review.
 */
export default function ReviewModal({
  businessId,
  isOpen,
  onClose,
  onReviewSubmitted,
  existingReview,
}: ReviewModalProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState(existingReview?.text ?? '');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const captchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    if (!isOpen) {
      setRating(existingReview?.rating ?? 0);
      setText(existingReview?.text ?? '');
      setCaptchaToken(null);
      setError('');
    }
  }, [isOpen, existingReview]);

  /** Close when clicking the dark overlay. */
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (rating < 1) { setError('Please select a star rating.'); return; }
    if (SITE_KEY && !captchaToken) { setError('Please complete the reCAPTCHA.'); return; }

    setSubmitting(true);
    try {
      const resp = await post<ApiResponse<Review>>('/reviews', {
        business_id: businessId,
        rating,
        text: text.trim() || null,
        captcha_token: captchaToken ?? '',
      });
      if (resp.error) { setError(resp.error); captchaRef.current?.reset(); return; }
      onReviewSubmitted();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit review. Please try again.');
      captchaRef.current?.reset();
      logger.error('Review submission failed', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        <h2 className={styles.title}>Leave a Review</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <fieldset className={styles.starFieldset}>
            <legend className={styles.fieldLabel}>Rating *</legend>
            <div className={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.star} ${n <= (hovered || rating) ? styles.active : ''}`}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <label className={styles.fieldLabel}>
            Review <span className={styles.charCount}>({text.length}/1000)</span>
            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="Share your experience (optional)…"
            />
          </label>

          {SITE_KEY ? (
            <div className={styles.captchaWrapper}>
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={SITE_KEY}
                onChange={(token) => setCaptchaToken(token)}
              />
            </div>
          ) : (
            <p className={styles.captchaNote}>reCAPTCHA not configured — submit allowed.</p>
          )}

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
