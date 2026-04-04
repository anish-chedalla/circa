/**
 * Map Discovery page — the primary demo page.
 * Shows an interactive Leaflet map, filter bar, and business sidebar.
 * Hidden Gems mode is toggled from the filter bar and shown in the sidebar.
 */

import { useEffect, useState, useCallback } from 'react';

import { get } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse, Business, BusinessFilters } from '../types';
import FilterBar from '../components/FilterBar';
import MapView from '../components/MapView';
import BusinessSidebar from '../components/BusinessSidebar';
import styles from './MapDiscovery.module.css';

const DEFAULT_FILTERS: BusinessFilters = {
  category: '',
  city: '',
  minRating: 0,
  hasDeals: false,
  sortBy: 'name',
  search: '',
};

/** Build query string from filter state. */
function buildQuery(filters: BusinessFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.city) params.set('city', filters.city);
  if (filters.minRating > 0) params.set('min_rating', String(filters.minRating));
  if (filters.hasDeals) params.set('has_deals', 'true');
  if (filters.sortBy) params.set('sort_by', filters.sortBy);
  if (filters.search) params.set('search', filters.search);
  params.set('limit', '100');
  return params.toString();
}

/**
 * Renders the interactive Map Discovery page with filters, sidebar, and Hidden Gems toggle.
 */
export default function MapDiscovery() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [gems, setGems] = useState<Business[]>([]);
  const [filters, setFilters] = useState<BusinessFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [gemsLoading, setGemsLoading] = useState(true);
  const [showGems, setShowGems] = useState(false);

  const fetchBusinesses = useCallback(async (f: BusinessFilters) => {
    setLoading(true);
    try {
      const resp = await get<ApiResponse<Business[]>>(`/businesses?${buildQuery(f)}`);
      setBusinesses(resp.data ?? []);
    } catch (err) {
      logger.error('Failed to fetch businesses', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBusinesses(filters);
  }, [filters, fetchBusinesses]);

  useEffect(() => {
    get<ApiResponse<string[]>>('/businesses/categories')
      .then((resp) => setCategories(resp.data ?? []))
      .catch((err) => logger.error('Failed to fetch categories', err));

    get<ApiResponse<Business[]>>('/businesses/hidden-gems?limit=10')
      .then((resp) => { setGems(resp.data ?? []); setGemsLoading(false); })
      .catch((err) => { logger.error('Failed to fetch hidden gems', err); setGemsLoading(false); });
  }, []);

  return (
    <div className={styles.page}>
      <FilterBar
        filters={filters}
        categories={categories}
        onFilterChange={setFilters}
        showGems={showGems}
        onToggleGems={() => setShowGems((prev) => !prev)}
      />
      <div className={styles.main}>
        <MapView businesses={businesses} />
        <BusinessSidebar
          businesses={businesses}
          loading={loading}
          gems={gems}
          gemsLoading={gemsLoading}
          showGems={showGems}
        />
      </div>
    </div>
  );
}
