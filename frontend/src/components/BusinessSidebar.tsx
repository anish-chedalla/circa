/**
 * Scrollable sidebar listing businesses matching the current filters,
 * or Hidden Gems when gems mode is active.
 */

import { Link } from 'react-router-dom';

import type { Business } from '../types';
import BusinessCard from './BusinessCard';
import StarRating from './StarRating';
import styles from './BusinessSidebar.module.css';

interface BusinessSidebarProps {
  /** Filtered list of businesses to display in normal mode. */
  businesses: Business[];
  /** Whether the business list is loading. */
  loading: boolean;
  /** Hidden Gems list. */
  gems: Business[];
  /** Whether Hidden Gems data is loading. */
  gemsLoading: boolean;
  /** Whether to show Hidden Gems instead of normal results. */
  showGems: boolean;
}

/**
 * Renders a scrollable business list. In gems mode, shows Hidden Gems sorted by score.
 */
export default function BusinessSidebar({ businesses, loading, gems, gemsLoading, showGems }: BusinessSidebarProps) {
  if (showGems) {
    return (
      <aside className={styles.sidebar}>
        <div className={`${styles.countBar} ${styles.gemsHeader}`}>
          ✦ Hidden Gems — scored by rating · volume · recency
        </div>
        {gemsLoading ? (
          <p className={styles.status}>Loading hidden gems…</p>
        ) : gems.length === 0 ? (
          <p className={styles.status}>No hidden gems found yet — add more reviews to unlock them.</p>
        ) : (
          <div className={styles.list}>
            {gems.map((biz) => (
              <Link key={biz.id} to={`/business/${biz.id}`} className={styles.gemCard}>
                <div className={styles.gemTop}>
                  <span className={styles.gemCategory}>{biz.category}</span>
                  {biz.score !== undefined && (
                    <span className={styles.gemScore}>{biz.score.toFixed(2)}</span>
                  )}
                </div>
                <span className={styles.gemName}>{biz.name}</span>
                <div className={styles.gemMeta}>
                  <StarRating rating={biz.avg_rating} size="sm" />
                  <span className={styles.gemRating}>{biz.avg_rating.toFixed(1)}</span>
                  <span className={styles.gemCity}>{biz.city}</span>
                </div>
                {biz.has_active_deals && <span className={styles.gemDeal}>Deal</span>}
              </Link>
            ))}
          </div>
        )}
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className={styles.sidebar}>
        <p className={styles.status}>Loading businesses…</p>
      </aside>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.countBar}>
        {businesses.length === 0
          ? 'No businesses match your filters'
          : `Showing ${businesses.length} business${businesses.length === 1 ? '' : 'es'}`}
      </div>
      <div className={styles.list}>
        {businesses.map((biz) => (
          <BusinessCard key={biz.id} business={biz} />
        ))}
      </div>
    </aside>
  );
}
