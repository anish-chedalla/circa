/**
 * Reusable star-rating display component.
 * Renders filled, half-filled, and empty stars for a numeric rating.
 */

import styles from './StarRating.module.css';

interface StarRatingProps {
  /** Numeric rating value (e.g. 3.5). */
  rating: number;
  /** Maximum number of stars to display. Defaults to 5. */
  maxStars?: number;
  /** One of the preset size tokens. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg' | string;
}

/**
 * Displays a row of star icons representing the given rating.
 */
export default function StarRating({ rating, maxStars = 5, size = 'md' }: StarRatingProps) {
  const sizeClass =
    size === 'sm' ? styles.sm
    : size === 'lg' ? styles.lg
    : styles.md;

  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= maxStars; i++) {
    let starClass = styles.star;
    if (rating >= i) starClass += ` ${styles.filled}`;
    else if (rating >= i - 0.5) starClass += ` ${styles.half}`;

    stars.push(
      <span key={i} className={`${starClass} ${sizeClass}`} aria-hidden="true">
        &#9733;
      </span>,
    );
  }

  return (
    <span
      className={styles.container}
      role="img"
      aria-label={`${rating} out of ${maxStars} stars`}
    >
      {stars}
    </span>
  );
}
