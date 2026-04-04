/**
 * Analytics page: platform-wide statistics with Recharts visualizations.
 */

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Legend,
} from 'recharts';

import { get } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse } from '../types';
import styles from './AnalyticsPage.module.css';

interface BizStat {
  id: number;
  name: string;
  category: string;
  avg_rating: number;
  review_count: number;
}

interface AnalyticsData {
  top_rated: BizStat[];
  most_reviewed: BizStat[];
  category_counts: Record<string, number>;
  active_deals_count: number;
  total_businesses: number;
  total_reviews: number;
  total_users: number;
}

interface CategoryDatum { name: string; count: number; fill: string; }

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

/** Truncate long strings for axis labels. */
function truncate(s: string, n = 14): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/**
 * Renders the analytics dashboard with stat cards and Recharts charts.
 */
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<ApiResponse<AnalyticsData>>('/analytics')
      .then((resp) => setData(resp.data))
      .catch((err) => logger.error('Failed to load analytics', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.status}>Loading analytics…</div>;
  if (!data) return <div className={styles.status}>Failed to load analytics data.</div>;

  const topRatedData = data.top_rated.map((b) => ({
    name: truncate(b.name),
    rating: b.avg_rating,
  }));

  const mostReviewedData = data.most_reviewed.map((b) => ({
    name: truncate(b.name),
    reviews: b.review_count,
  }));

  const categoryData: CategoryDatum[] = Object.entries(data.category_counts).map(
    ([name, count], i) => ({ name, count, fill: COLORS[i % COLORS.length] }),
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Platform Analytics</h1>

      <div className={styles.statCards}>
        <StatCard label="Businesses" value={data.total_businesses} color="#2563eb" />
        <StatCard label="Reviews" value={data.total_reviews} color="#10b981" />
        <StatCard label="Users" value={data.total_users} color="#8b5cf6" />
        <StatCard label="Active Deals" value={data.active_deals_count} color="#f59e0b" />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Top 10 Rated Businesses</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topRatedData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="rating" name="Avg Rating" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Top 10 Most Reviewed</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mostReviewedData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="reviews" name="Review Count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Businesses by Category</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={100}
                paddingAngle={2}
              />
              <Tooltip />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '0.78rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps { label: string; value: number; color: string; }

/** Single stat number card. Uses a CSS variable via data attribute to avoid inline styles. */
function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statValue} style={{ color }}>{value.toLocaleString()}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
