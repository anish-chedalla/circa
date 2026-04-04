/**
 * Card displaying a single promotional deal for a business.
 */

import type { DealItem } from '../types';
import styles from './DealCard.module.css';

interface DealCardProps {
  deal: DealItem;
}

/** Format an ISO date string to a readable date. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Return true if the deal expires within 7 days. */
function expiringSoon(iso: string | null): boolean {
  if (!iso) return false;
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Renders a deal card with title, description, and expiry info.
 */
export default function DealCard({ deal }: DealCardProps) {
  const soon = expiringSoon(deal.expiry_date);
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{deal.title}</span>
        {soon && <span className={styles.expiringSoon}>Expiring Soon!</span>}
      </div>
      {deal.description && <p className={styles.description}>{deal.description}</p>}
      {deal.expiry_date && (
        <span className={styles.expiry}>Expires {formatDate(deal.expiry_date)}</span>
      )}
    </div>
  );
}
