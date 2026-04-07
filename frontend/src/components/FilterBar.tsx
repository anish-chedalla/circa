/**
 * Filter bar for the Map Discovery page.
 *
 * UX model:
 * - Quick controls stay visible (search, sort, hidden gems, advanced toggle).
 * - Advanced controls live in a collapsible panel.
 * - Advanced filters apply only when user presses "Apply Search".
 * - Reopening the panel preserves the last applied values for fast iteration.
 */

import { useEffect, useRef, useState } from 'react';

import type { BusinessFilters } from '../types';
import styles from './FilterBar.module.css';

const CITIES = ['All Cities', 'Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Tucson', 'Oro Valley', 'Marana'];
const STATES = ['All States', 'AZ'];
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'reviews', label: 'Most Reviewed' },
];

interface FilterBarProps {
  filters: BusinessFilters;
  categories: string[];
  onFilterChange: (updated: BusinessFilters) => void;
  showGems: boolean;
  onToggleGems: () => void;
}

export default function FilterBar({ filters, categories, onFilterChange, showGems, onToggleGems }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draft, setDraft] = useState<BusinessFilters>(filters);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(filters);
    setSearchInput(filters.search);
  }, [filters]);

  // Debounced quick search for instant discovery experience.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ ...filters, search: searchInput });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  function updateDraft<K extends keyof BusinessFilters>(key: K, value: BusinessFilters[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyAdvancedSearch() {
    onFilterChange({ ...draft, search: searchInput });
    setAdvancedOpen(false);
  }

  function clearAdvancedSearch() {
    const reset: BusinessFilters = {
      ...filters,
      category: '',
      city: '',
      state: '',
      zip: '',
      minRating: 0,
      maxRating: 5,
      minReviews: 0,
      maxReviews: 0,
      hasDeals: false,
      hasWebsite: false,
      hasPhone: false,
      hasPhoto: false,
      hasSummary: false,
      chainType: 'any',
      sortBy: 'name',
      search: '',
    };
    setSearchInput('');
    setDraft(reset);
    onFilterChange(reset);
    setAdvancedOpen(false);
  }

  return (
    <div className={styles.wrap}>
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
          value={filters.sortBy}
          onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value })}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          type="button"
          className={styles.advancedBtn}
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-expanded={advancedOpen}
        >
          Advanced Search
        </button>

        <button
          type="button"
          className={`${styles.gemsToggle} ${showGems ? styles.gemsActive : ''}`}
          onClick={onToggleGems}
          title="Show algorithmically scored hidden gem businesses"
          aria-pressed={showGems}
        >
          Hidden Gems
        </button>
      </div>

      {advancedOpen && (
        <section className={styles.advancedPanel} aria-label="Advanced business filters">
          <div className={styles.grid}>
            <label className={styles.fieldLabel}>
              Category
              <select
                className={styles.select}
                value={draft.category}
                onChange={(e) => updateDraft('category', e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>

            <label className={styles.fieldLabel}>
              City
              <select
                className={styles.select}
                value={draft.city}
                onChange={(e) => updateDraft('city', e.target.value)}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c === 'All Cities' ? '' : c}>{c}</option>
                ))}
              </select>
            </label>

            <label className={styles.fieldLabel}>
              State
              <select
                className={styles.select}
                value={draft.state ?? ''}
                onChange={(e) => updateDraft('state', e.target.value)}
              >
                {STATES.map((s) => (
                  <option key={s} value={s === 'All States' ? '' : s}>{s}</option>
                ))}
              </select>
            </label>

            <label className={styles.fieldLabel}>
              ZIP Starts With
              <input
                className={styles.input}
                type="text"
                maxLength={10}
                value={draft.zip ?? ''}
                onChange={(e) => updateDraft('zip', e.target.value)}
                placeholder="e.g. 852"
              />
            </label>

            <label className={styles.fieldLabel}>
              Min Rating
              <input
                className={styles.input}
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={draft.minRating}
                onChange={(e) => updateDraft('minRating', Number(e.target.value) || 0)}
              />
            </label>

            <label className={styles.fieldLabel}>
              Max Rating
              <input
                className={styles.input}
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={draft.maxRating ?? 5}
                onChange={(e) => updateDraft('maxRating', Number(e.target.value) || 5)}
              />
            </label>

            <label className={styles.fieldLabel}>
              Min Reviews
              <input
                className={styles.input}
                type="number"
                min={0}
                step={1}
                value={draft.minReviews ?? 0}
                onChange={(e) => updateDraft('minReviews', Number(e.target.value) || 0)}
              />
            </label>

            <label className={styles.fieldLabel}>
              Max Reviews
              <input
                className={styles.input}
                type="number"
                min={0}
                step={1}
                value={draft.maxReviews ?? 0}
                onChange={(e) => updateDraft('maxReviews', Number(e.target.value) || 0)}
              />
            </label>

            <label className={styles.fieldLabel}>
              Business Type
              <select
                className={styles.select}
                value={draft.chainType ?? 'any'}
                onChange={(e) => updateDraft('chainType', e.target.value as BusinessFilters['chainType'])}
              >
                <option value="any">Any</option>
                <option value="independent">Independent Only</option>
                <option value="chain">Chains Only</option>
              </select>
            </label>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.hasDeals}
                onChange={(e) => updateDraft('hasDeals', e.target.checked)}
              />
              Has Deals
            </label>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.hasWebsite ?? false}
                onChange={(e) => updateDraft('hasWebsite', e.target.checked)}
              />
              Has Website
            </label>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.hasPhone ?? false}
                onChange={(e) => updateDraft('hasPhone', e.target.checked)}
              />
              Has Phone
            </label>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.hasPhoto ?? false}
                onChange={(e) => updateDraft('hasPhoto', e.target.checked)}
              />
              Has Photo
            </label>

            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={draft.hasSummary ?? false}
                onChange={(e) => updateDraft('hasSummary', e.target.checked)}
              />
              Has Summary
            </label>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.applyBtn} onClick={applyAdvancedSearch}>
              Apply Search
            </button>
            <button type="button" className={styles.clearBtn} onClick={clearAdvancedSearch}>
              Clear Filters
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
