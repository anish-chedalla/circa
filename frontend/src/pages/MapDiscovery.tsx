/**
 * Map Discovery page — the primary demo page.
 * Injects the FilterBar into the Navbar slot so filters live in the header.
 * Shows an interactive Leaflet map and business sidebar.
 */

import { useEffect, useState, useCallback } from 'react';

import { get } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse, Business, BusinessFilters } from '../types';
import FilterBar from '../components/FilterBar';
import MapView from '../components/MapView';
import BusinessSidebar from '../components/BusinessSidebar';
import { useNavbarSlot } from '../context/NavbarSlotContext';
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
 * Renders the interactive Map Discovery page.
 * Filter controls are injected into the Navbar via NavbarSlotContext.
 */
export default function MapDiscovery() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [gems, setGems] = useState<Business[]>([]);
  const [filters, setFilters] = useState<BusinessFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [gemsLoading, setGemsLoading] = useState(true);
  const [showGems, setShowGems] = useState(false);
  const { setSlot } = useNavbarSlot();

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

  // Inject FilterBar into the Navbar slot; update when state changes; clear on unmount
  useEffect(() => {
    setSlot(
      <FilterBar
        filters={filters}
        categories={categories}
        onFilterChange={setFilters}
        showGems={showGems}
        onToggleGems={() => setShowGems((prev) => !prev)}
      />
    );
  }, [filters, categories, showGems, setSlot]);

  useEffect(() => {
    return () => setSlot(null);
  }, [setSlot]);

  return (
    <div className={styles.page}>
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
