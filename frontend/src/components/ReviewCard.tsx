/**
 * Card displaying a single user review for a business.
 */

import type { ReviewItem } from '../types';
import StarRating from './StarRating';
import styles from './ReviewCard.module.css';

interface ReviewCardProps {
  review: ReviewItem;
}

/** Format an ISO date to a readable string. */
function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/**
 * Renders a review card with reviewer, rating, text, and date.
 */
export default function ReviewCard({ review }: ReviewCardProps) {
  const email = review.user?.email ?? 'Anonymous';
  const displayName = email.split('@')[0];

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.author}>{displayName}</span>
        <StarRating rating={review.rating} size="0.9rem" />
        <span className={styles.date}>{formatDate(review.created_at)}</span>
      </div>
      {review.text && <p className={styles.text}>{review.text}</p>}
    </div>
  );
}
