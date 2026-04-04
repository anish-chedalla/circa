/**
 * Scrollable sidebar listing businesses matching the current filters.
 */

import type { Business } from '../types';
import BusinessCard from './BusinessCard';
import styles from './BusinessSidebar.module.css';

interface BusinessSidebarProps {
  /** Filtered list of businesses to display. */
  businesses: Business[];
  /** Whether the data is still loading. */
  loading: boolean;
}

/**
 * Renders a scrollable list of BusinessCard components.
 */
export default function BusinessSidebar({ businesses, loading }: BusinessSidebarProps) {
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
