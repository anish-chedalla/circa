/**
 * Hidden Gems section for the Map Discovery page.
 * Displays algorithmically scored underappreciated businesses.
 */

import { Link } from 'react-router-dom';

import type { Business } from '../types';
import StarRating from './StarRating';
import styles from './HiddenGems.module.css';

interface HiddenGemsProps {
  /** List of hidden gem businesses. */
  gems: Business[];
  /** Whether data is loading. */
  loading: boolean;
}

/**
 * Renders a horizontal scrollable row of hidden gem business cards.
 */
export default function HiddenGems({ gems, loading }: HiddenGemsProps) {
  return (
    <section className={styles.section}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          ✦ Hidden Gems
          <span
            className={styles.infoIcon}
            title="Scored by: avg_rating × log10(1 + review_count) × recency_factor. Surfaces actively-loved local businesses that haven't gone mainstream."
          >
            ?
          </span>
        </h2>
        <span className={styles.subtitle}>Underappreciated local favorites, scored by rating · volume · recency</span>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading hidden gems…</p>
      ) : gems.length === 0 ? (
        <p className={styles.loading}>No hidden gems found yet.</p>
      ) : (
        <div className={styles.scroll}>
          {gems.map((biz) => (
            <Link key={biz.id} to={`/business/${biz.id}`} className={styles.card}>
              <span className={styles.cardCategory}>{biz.category}</span>
              <span className={styles.cardName}>{biz.name}</span>
              <div className={styles.cardMeta}>
                <StarRating rating={biz.avg_rating} size="0.8rem" />
                <span className={styles.cardRating}>{biz.avg_rating.toFixed(1)}</span>
              </div>
              <span className={styles.cardCity}>{biz.city}</span>
              {biz.has_active_deals && <span className={styles.dealBadge}>Deal</span>}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
