import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { del, get, post, put } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse } from '../types';
import styles from './OwnerDashboard.module.css';

interface DealItem {
  id: number;
  title: string;
  description: string | null;
  expiry_date: string | null;
  is_active: boolean;
}

interface OwnerBusinessSummary {
  id: number;
  name: string;
  category: string;
  city: string;
  listing_status: 'approved' | 'pending' | 'rejected' | string;
  claimed: boolean;
  created_at: string | null;
}

interface OwnerBusinessDetail extends OwnerBusinessSummary {
  description: string | null;
  phone: string | null;
  website: string | null;
  hours: Record<string, string> | null;
  avg_rating: number;
  review_count: number;
  deals: DealItem[];
}

interface AnalyticsPoint {
  date: string;
  events: number;
}

interface EventTypePoint {
  event_type: string;
  count: number;
}

interface OwnerAnalytics {
  days: number;
  total_events: number;
  detail_views: number;
  website_clicks: number;
  save_clicks: number;
  phone_clicks: number;
  daily_events: AnalyticsPoint[];
  by_event_type: EventTypePoint[];
}

interface ListingHistoryItem {
  id: number;
  name: string;
  category: string;
  city: string;
  listing_status: 'approved' | 'pending' | 'rejected' | string;
  claimed: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface OwnerDashboardPayload {
  businesses: OwnerBusinessSummary[];
  selected_business: OwnerBusinessDetail | null;
  listing_history: ListingHistoryItem[];
  analytics: OwnerAnalytics | null;
}

const PIE_COLORS = ['#3b4cc0', '#5969d6', '#8a9bef', '#bac4ff'];

export default function OwnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<OwnerDashboardPayload | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);

  const [desc, setDesc] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const [dealTitle, setDealTitle] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealExpiry, setDealExpiry] = useState('');
  const [dealMsg, setDealMsg] = useState('');
  const [dealError, setDealError] = useState('');

  const selectedBusiness = payload?.selected_business ?? null;
  const analytics = payload?.analytics ?? null;
  const businesses = payload?.businesses ?? [];
  const listingHistory = payload?.listing_history ?? [];
  const hasBusinesses = (payload?.businesses.length ?? 0) > 0;

  async function loadDashboard(targetBusinessId?: number) {
    setLoading(true);
    try {
      const query = targetBusinessId ? `?business_id=${targetBusinessId}` : '';
      const resp = await get<ApiResponse<OwnerDashboardPayload>>(`/owner/dashboard${query}`);
      if (!resp.data) {
        setPayload({
          businesses: [],
          selected_business: null,
          listing_history: [],
          analytics: null,
        });
        return;
      }
      setPayload(resp.data);
      if (resp.data.selected_business) {
        setSelectedBusinessId(resp.data.selected_business.id);
        setDesc(resp.data.selected_business.description ?? '');
        setPhone(resp.data.selected_business.phone ?? '');
        setWebsite(resp.data.selected_business.website ?? '');
      }
    } catch (err) {
      logger.error('Failed to load owner dashboard', err);
      setPayload({
        businesses: [],
        selected_business: null,
        listing_history: [],
        analytics: null,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleBusinessChange(nextId: number) {
    setSelectedBusinessId(nextId);
    await loadDashboard(nextId);
    setSaveMsg('');
    setSaveError('');
    setDealMsg('');
    setDealError('');
  }

  async function saveBusiness() {
    if (!selectedBusinessId) return;
    setSaveMsg('');
    setSaveError('');
    try {
      const resp = await put<ApiResponse<OwnerBusinessDetail>>(
        `/owner/business?business_id=${selectedBusinessId}`,
        {
          description: desc,
          phone,
          website,
        },
      );
      if (resp.error) {
        setSaveError(resp.error);
        return;
      }
      setSaveMsg('Saved successfully.');
      await loadDashboard(selectedBusinessId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSaveError(msg ?? 'Failed to save.');
      logger.error('Save business failed', err);
    }
  }

  async function postDeal() {
    if (!selectedBusinessId) return;
    setDealMsg('');
    setDealError('');
    if (!dealTitle.trim()) {
      setDealError('Title is required.');
      return;
    }
    try {
      const resp = await post<ApiResponse<DealItem>>(
        `/owner/deals?business_id=${selectedBusinessId}`,
        {
          title: dealTitle,
          description: dealDesc || null,
          expiry_date: dealExpiry || null,
        },
      );
      if (resp.error) {
        setDealError(resp.error);
        return;
      }
      setDealTitle('');
      setDealDesc('');
      setDealExpiry('');
      setDealMsg('Deal posted.');
      await loadDashboard(selectedBusinessId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setDealError(msg ?? 'Failed to post deal.');
      logger.error('Post deal failed', err);
    }
  }

  async function removeDeal(dealId: number) {
    if (!selectedBusinessId) return;
    try {
      await del(`/owner/deals/${dealId}?business_id=${selectedBusinessId}`);
      await loadDashboard(selectedBusinessId);
    } catch (err) {
      logger.error('Remove deal failed', err);
    }
  }

  const eventBreakdown = useMemo(() => {
    return payload?.analytics?.by_event_type.map((row) => ({
      ...row,
      label: row.event_type.replace('_', ' '),
    })) ?? [];
  }, [payload?.analytics]);

  const hasTrafficPoints = (analytics?.daily_events ?? []).some((point) => point.events > 0);

  if (loading) return <div className={styles.status}>Loading owner dashboard...</div>;

  if (!hasBusinesses || !selectedBusiness) {
    return (
      <div className={styles.status}>
        <h2>Owner dashboard</h2>
        <p>No listings yet. Create one to start tracking traffic and engagement.</p>
        <Link to="/owner/new-listing" className={styles.primaryLink}>
          Create a business listing
        </Link>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <h1 className={styles.title}>Business Dashboard</h1>
          <p className={styles.lead}>
            Track discovery activity, keep your listing updated, and manage deals from one place.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link to="/owner/new-listing" className={styles.primaryLink}>
            + New Business Listing
          </Link>
          <label className={styles.selectorLabel}>
            Select business
            <select
              className={styles.selector}
              value={selectedBusinessId ?? selectedBusiness.id}
              onChange={(e) => void handleBusinessChange(Number(e.target.value))}
            >
              {businesses.map((biz) => (
                <option key={biz.id} value={biz.id}>
                  {biz.name} ({biz.city})
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className={styles.metricsRow}>
        <MetricCard label="Total Events (30d)" value={analytics?.total_events ?? 0} />
        <MetricCard label="Detail Views" value={analytics?.detail_views ?? 0} />
        <MetricCard label="Website Clicks" value={analytics?.website_clicks ?? 0} />
        <MetricCard label="Save Clicks" value={analytics?.save_clicks ?? 0} />
      </section>

      <section className={styles.chartGrid}>
        <article className={styles.chartCard}>
          <h2 className={styles.sectionTitle}>Traffic Trend</h2>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics?.daily_events ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="events" stroke="#3b4cc0" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            {!hasTrafficPoints && <p className={styles.chartNote}>No traffic data yet for this date window.</p>}
          </div>
        </article>

        <article className={styles.chartCard}>
          <h2 className={styles.sectionTitle}>Event Breakdown</h2>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Tooltip />
                <Pie
                  data={eventBreakdown}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => `${String(name)}: ${Number(value ?? 0)}`}
                >
                  {eventBreakdown.map((entry, index) => (
                    <Cell key={entry.event_type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className={styles.editorialGrid}>
        <article className={styles.panel}>
          <h2 className={styles.sectionTitle}>Edit Listing</h2>
          <p className={styles.businessMeta}>
            {selectedBusiness.name} | {selectedBusiness.category} | {selectedBusiness.city}
          </p>
          <label className={styles.fieldLabel}>
            Description
            <textarea
              className={styles.textarea}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
            />
          </label>
          <label className={styles.fieldLabel}>
            Phone
            <input
              className={styles.input}
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+16025551234"
            />
          </label>
          <label className={styles.fieldLabel}>
            Website
            <input
              className={styles.input}
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          {saveMsg && <p className={styles.successMsg}>{saveMsg}</p>}
          {saveError && <p className={styles.errorMsg}>{saveError}</p>}
          <button className={styles.primaryBtn} onClick={() => void saveBusiness()}>
            Save Changes
          </button>
        </article>

        <article className={styles.panel}>
          <h2 className={styles.sectionTitle}>Deals</h2>
          {selectedBusiness.deals.length === 0 && <p className={styles.muted}>No active deals yet.</p>}
          {selectedBusiness.deals.map((deal) => (
            <div key={deal.id} className={styles.dealRow}>
              <div>
                <strong>{deal.title}</strong>
                {deal.description && <p>{deal.description}</p>}
                {deal.expiry_date && <span>Expires {deal.expiry_date}</span>}
              </div>
              <button className={styles.ghostBtn} onClick={() => void removeDeal(deal.id)}>
                Remove
              </button>
            </div>
          ))}
          <div className={styles.formDivider} />
          <h3 className={styles.subTitle}>Post New Deal</h3>
          <label className={styles.fieldLabel}>
            Title
            <input
              className={styles.input}
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
              maxLength={100}
            />
          </label>
          <label className={styles.fieldLabel}>
            Description
            <textarea
              className={styles.textarea}
              rows={2}
              value={dealDesc}
              onChange={(e) => setDealDesc(e.target.value)}
            />
          </label>
          <label className={styles.fieldLabel}>
            Expiry Date
            <input
              className={styles.input}
              type="date"
              value={dealExpiry}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDealExpiry(e.target.value)}
            />
          </label>
          {dealMsg && <p className={styles.successMsg}>{dealMsg}</p>}
          {dealError && <p className={styles.errorMsg}>{dealError}</p>}
          <button className={styles.primaryBtn} onClick={() => void postDeal()}>
            Post Deal
          </button>
        </article>
      </section>

      <section className={styles.historySection}>
        <h2 className={styles.sectionTitle}>Listing History</h2>
        <div className={styles.historyTableWrap}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Business</th>
                <th>Category</th>
                <th>City</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {listingHistory.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td>{row.city}</td>
                  <td>
                    <span className={`${styles.badge} ${statusClass(row.listing_status, styles)}`}>
                      {row.listing_status}
                    </span>
                  </td>
                  <td>{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function statusClass(status: string, css: Record<string, string>): string {
  if (status === 'approved') return css.statusApproved;
  if (status === 'pending') return css.statusPending;
  if (status === 'rejected') return css.statusRejected;
  return '';
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

interface MetricCardProps {
  label: string;
  value: number;
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <article className={styles.metricCard}>
      <p>{label}</p>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}
