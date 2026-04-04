/**
 * Admin Dashboard: approve/reject business claims and moderate reviews.
 * Requires admin role.
 */

import { useEffect, useState } from 'react';

import { get, post, del } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse } from '../types';
import styles from './AdminDashboard.module.css';

interface ClaimItem {
  id: number;
  business_id: number;
  business_name: string | null;
  user_id: number;
  user_email: string | null;
  status: string;
  submitted_at: string | null;
}

interface ReviewItem {
  id: number;
  business_name: string | null;
  user_email: string | null;
  rating: number;
  text: string | null;
  created_at: string | null;
}

type Tab = 'claims' | 'reviews';

/** Format ISO date string to readable date. */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Renders the admin dashboard with pending claims and review moderation tabs.
 */
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('claims');
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    get<ApiResponse<ClaimItem[]>>('/admin/claims')
      .then((r) => setClaims(r.data ?? []))
      .catch((err) => logger.error('Failed to load claims', err))
      .finally(() => setClaimsLoading(false));
  }, []);

  async function loadReviews() {
    if (reviews.length > 0) return;
    setReviewsLoading(true);
    try {
      const r = await get<ApiResponse<ReviewItem[]>>('/admin/reviews');
      setReviews(r.data ?? []);
    } catch (err) { logger.error('Failed to load reviews', err); }
    finally { setReviewsLoading(false); }
  }

  function switchTab(t: Tab) {
    setTab(t);
    if (t === 'reviews') loadReviews();
  }

  async function handleClaim(claimId: number, action: 'approve' | 'reject') {
    try {
      await post(`/admin/claims/${claimId}/${action}`);
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
      setActionMsg(`Claim ${action}d successfully.`);
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) { logger.error(`Failed to ${action} claim`, err); }
  }

  async function handleRemoveReview(reviewId: number) {
    if (!window.confirm('Remove this review permanently?')) return;
    try {
      await del(`/admin/reviews/${reviewId}`);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setActionMsg('Review removed.');
      setTimeout(() => setActionMsg(''), 3000);
    } catch (err) { logger.error('Failed to remove review', err); }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Admin Dashboard</h1>

      {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'claims' ? styles.activeTab : ''}`} onClick={() => switchTab('claims')}>
          Pending Claims {claims.length > 0 && <span className={styles.badge}>{claims.length}</span>}
        </button>
        <button className={`${styles.tab} ${tab === 'reviews' ? styles.activeTab : ''}`} onClick={() => switchTab('reviews')}>
          Review Moderation
        </button>
      </div>

      {tab === 'claims' && (
        <div className={styles.tableWrapper}>
          {claimsLoading ? <p className={styles.status}>Loading…</p> : claims.length === 0 ? (
            <p className={styles.status}>No pending claims.</p>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Business</th><th>User</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td className={styles.bizCell}>{c.business_name ?? `#${c.business_id}`}</td>
                    <td>{c.user_email ?? `#${c.user_id}`}</td>
                    <td>{fmtDate(c.submitted_at)}</td>
                    <td className={styles.actionCell}>
                      <button className={styles.approveBtn} onClick={() => handleClaim(c.id, 'approve')}>Approve</button>
                      <button className={styles.rejectBtn} onClick={() => handleClaim(c.id, 'reject')}>Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className={styles.tableWrapper}>
          {reviewsLoading ? <p className={styles.status}>Loading…</p> : reviews.length === 0 ? (
            <p className={styles.status}>No reviews found.</p>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Business</th><th>Reviewer</th><th>Rating</th><th>Review</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.bizCell}>{r.business_name ?? '—'}</td>
                    <td>{r.user_email ?? '—'}</td>
                    <td>{'★'.repeat(r.rating)}</td>
                    <td className={styles.reviewText}>{r.text ? r.text.slice(0, 60) + (r.text.length > 60 ? '…' : '') : '—'}</td>
                    <td>{fmtDate(r.created_at)}</td>
                    <td><button className={styles.rejectBtn} onClick={() => handleRemoveReview(r.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
