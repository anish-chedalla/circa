/**
 * Authenticated user profile page.
 * Shows favorites, recommendations, and account info.
 */

import { useEffect, useState } from 'react';

import { get, del } from '../services/api';
import logger from '../services/logger';
import { useAuth } from '../hooks/useAuth';
import type { ApiResponse, Business } from '../types';
import BusinessCard from '../components/BusinessCard';
import styles from './ProfilePage.module.css';

/**
 * Renders the user profile with favorites list, recommendations, and account info.
 */
export default function ProfilePage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Business[]>([]);
  const [recommendations, setRecommendations] = useState<Business[]>([]);
  const [recoFallback, setRecoFallback] = useState(false);
  const [favLoading, setFavLoading] = useState(true);
  const [recoLoading, setRecoLoading] = useState(true);

  useEffect(() => {
    get<ApiResponse<Business[]>>('/favorites')
      .then((resp) => setFavorites(resp.data ?? []))
      .catch((err) => logger.error('Failed to fetch favorites', err))
      .finally(() => setFavLoading(false));

    get<{ data: Business[] | null; meta?: { fallback?: boolean }; error: string | null }>('/recommendations')
      .then((resp) => {
        setRecommendations(resp.data ?? []);
        setRecoFallback(resp.meta?.fallback ?? false);
      })
      .catch((err) => { logger.warn('Recommendations not available', err); setRecoLoading(false); })
      .finally(() => setRecoLoading(false));
  }, []);

  /** Remove a business from favorites and update local state. */
  async function unfavorite(businessId: number) {
    try {
      await del(`/favorites/${businessId}`);
      setFavorites((prev) => prev.filter((b) => b.id !== businessId));
    } catch (err) {
      logger.error('Failed to unfavorite', err);
    }
  }

  const roleLabelClass =
    user?.role === 'admin' ? styles.roleAdmin
    : user?.role === 'business_owner' ? styles.roleOwner
    : styles.roleUser;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.avatar}>{user?.email[0].toUpperCase()}</div>
        <div className={styles.userInfo}>
          <span className={styles.email}>{user?.email}</span>
          <span className={`${styles.roleBadge} ${roleLabelClass}`}>
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          My Favorites
          <span className={styles.count}>{favorites.length}</span>
        </h2>
        {favLoading ? (
          <p className={styles.status}>Loading…</p>
        ) : favorites.length === 0 ? (
          <p className={styles.status}>
            No saved businesses yet. Browse the <a href="/" className={styles.link}>map</a> and bookmark favorites!
          </p>
        ) : (
          <div className={styles.grid}>
            {favorites.map((biz) => (
              <div key={biz.id} className={styles.favItem}>
                <BusinessCard business={biz} />
                <button
                  className={styles.unfavBtn}
                  onClick={() => unfavorite(biz.id)}
                  title="Remove from favorites"
                >
                  ♥ Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Recommended for You
          {recoFallback && <span className={styles.fallbackNote}>(based on popular picks)</span>}
        </h2>
        {recoLoading ? (
          <p className={styles.status}>Loading recommendations…</p>
        ) : recommendations.length === 0 ? (
          <p className={styles.status}>
            Save 2+ favorites to unlock personalized recommendations.
          </p>
        ) : (
          <div className={styles.grid}>
            {recommendations.map((biz) => (
              <BusinessCard key={biz.id} business={biz} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.accountInfo}>
          <p className={styles.accountLine}><strong>Email:</strong> {user?.email}</p>
          <p className={styles.accountLine}><strong>Role:</strong> {user?.role?.replace('_', ' ')}</p>
          {user?.role === 'business_owner' && (
            <a href="/owner/dashboard" className={styles.dashboardLink}>
              Go to Business Dashboard →
            </a>
          )}
          {user?.role === 'user' && (
            <a href="/claim" className={styles.dashboardLink}>
              Claim a Business →
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
