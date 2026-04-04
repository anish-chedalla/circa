/**
 * Compact business card for the map sidebar list.
 * Displays key business info and links to the full detail page.
 */

import { Link } from 'react-router-dom';

import type { Business } from '../types';
import StarRating from './StarRating';
import styles from './BusinessCard.module.css';

interface BusinessCardProps {
  /** The business to display. */
  business: Business;
}

/**
 * Renders a compact card showing a business's name, category, rating, and city.
 */
export default function BusinessCard({ business }: BusinessCardProps) {
  return (
    <Link to={`/business/${business.id}`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{business.name}</span>
        {business.has_active_deals && (
          <span className={styles.dealBadge}>Deal</span>
        )}
      </div>
      <span className={styles.category}>{business.category}</span>
      <div className={styles.meta}>
        <StarRating rating={business.avg_rating} size="0.85rem" />
        <span className={styles.rating}>{business.avg_rating.toFixed(1)}</span>
        <span className={styles.reviewCount}>({business.review_count})</span>
        <span className={styles.city}>{business.city}</span>
      </div>
      {business.description && (
        <p className={styles.description}>{business.description.slice(0, 80)}…</p>
      )}
    </Link>
  );
}
