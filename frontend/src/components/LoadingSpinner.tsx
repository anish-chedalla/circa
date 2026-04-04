/**
 * Reusable full-page loading spinner used by Suspense and route guards.
 */

import styles from './LoadingSpinner.module.css';

/**
 * Renders a centred loading indicator.
 */
export default function LoadingSpinner() {
  return (
    <div className={styles.wrapper}>
      <span className={styles.spinner} aria-label="Loading" />
      <span className={styles.text}>Loading…</span>
    </div>
  );
}
