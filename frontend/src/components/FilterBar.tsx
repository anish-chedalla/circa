/**
 * Filter bar for the Map Discovery page.
 * Provides category, city, min-rating, has-deals, sort-by, search, and Hidden Gems toggle.
 */

import { useEffect, useRef, useState } from 'react';

import type { BusinessFilters } from '../types';
import styles from './FilterBar.module.css';

const CITIES = ['All Cities', 'Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Tucson', 'Oro Valley', 'Marana'];
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'reviews', label: 'Most Reviewed' },
];

interface FilterBarProps {
  /** Current filter values. */
  filters: BusinessFilters;
  /** Available categories fetched from the API. */
  categories: string[];
  /** Called whenever any filter value changes. */
  onFilterChange: (updated: BusinessFilters) => void;
  /** Whether Hidden Gems mode is active. */
  showGems: boolean;
  /** Toggle Hidden Gems mode on/off. */
  onToggleGems: () => void;
}

/**
 * Renders horizontal filter controls for the map discovery page.
 */
export default function FilterBar({ filters, categories, onFilterChange, showGems, onToggleGems }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filters, search: searchInput });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  /** Update a single filter field. */
  function update<K extends keyof BusinessFilters>(key: K, value: BusinessFilters[K]) {
    onFilterChange({ ...filters, [key]: value });
  }

  return (
    <div className={styles.bar}>
      <input
        className={styles.search}
        type="text"
        placeholder="Search businesses..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        aria-label="Search businesses"
      />

      <select
        className={styles.select}
        value={filters.category}
        onChange={(e) => update('category', e.target.value)}
        aria-label="Filter by category"
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <select
        className={styles.select}
        value={filters.city}
        onChange={(e) => update('city', e.target.value)}
        aria-label="Filter by city"
      >
        {CITIES.map((c) => (
          <option key={c} value={c === 'All Cities' ? '' : c}>{c}</option>
        ))}
      </select>

      <label className={styles.sliderLabel}>
        Min Rating: <strong>{filters.minRating > 0 ? `${filters.minRating}★` : 'Any'}</strong>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={filters.minRating}
          onChange={(e) => update('minRating', parseFloat(e.target.value))}
          aria-label="Minimum rating"
        />
      </label>

      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          checked={filters.hasDeals}
          onChange={(e) => update('hasDeals', e.target.checked)}
        />
        Has Deals
      </label>

      <select
        className={styles.select}
        value={filters.sortBy}
        onChange={(e) => update('sortBy', e.target.value)}
        aria-label="Sort by"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <button
        type="button"
        className={`${styles.gemsToggle} ${showGems ? styles.gemsActive : ''}`}
        onClick={onToggleGems}
        title="Show algorithmically scored hidden gem businesses"
        aria-pressed={showGems}
      >
        ✦ Hidden Gems
      </button>
    </div>
  );
}
