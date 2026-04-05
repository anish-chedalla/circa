import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { get } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse, Business } from '../types';
import styles from './AnalyticsPage.module.css';

interface AnalyticsData {
  category_counts: Record<string, number>;
  total_businesses: number;
  total_reviews: number;
  total_users: number;
}

interface GemBusiness extends Business {
  score?: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [gems, setGems] = useState<GemBusiness[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      get<ApiResponse<GemBusiness[]>>('/businesses/hidden-gems?limit=9'),
      get<ApiResponse<AnalyticsData>>('/analytics'),
    ])
      .then(([gemsResp, analyticsResp]) => {
        setGems(gemsResp.data ?? []);
        setAnalytics(analyticsResp.data);
      })
      .catch((err) => logger.error('Failed to load trending data', err))
      .finally(() => setLoading(false));
  }, []);

  const categoryHighlights = useMemo(() => {
    if (!analytics?.category_counts) return [];
    return Object.entries(analytics.category_counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [analytics]);

  const heroImage = gems.find((b) => b.google_photo_url)?.google_photo_url ?? '/about/small-business.jpg';

  if (loading) return <div className={styles.status}>Loading trending data...</div>;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroImageWrap}>
            <img src={heroImage} alt="Trending local businesses" className={styles.heroImage} />
          </div>

          <div className={styles.heroContent}>
            <p className={styles.kicker}>Trending</p>
            <div className={styles.kickerUnderline} aria-hidden="true" />
            <h1 className={styles.title}>Hidden Gems Across the Community</h1>
            <p className={styles.lead}>
              Circa highlights businesses with strong quality signals that deserve more visibility.
              Hidden gems are ranked by review quality, review activity, and recency.
            </p>

            {analytics && (
              <div className={styles.stats}>
                <Stat label="Businesses" value={analytics.total_businesses} />
                <Stat label="Reviews" value={analytics.total_reviews} />
                <Stat label="Users" value={analytics.total_users} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.trendingSection}>
        <div className={styles.container}>
          <p className={styles.kicker}>Top Picks</p>
          <div className={styles.kickerUnderline} aria-hidden="true" />
          <div className={styles.gemsGrid}>
            {gems.map((biz, index) => (
              <article key={biz.id} className={styles.gemRow}>
                <div className={styles.rank}>{index + 1}</div>
                <div className={styles.gemBody}>
                  <h2 className={styles.gemTitle}>
                    <Link to={`/business/${biz.id}`}>{biz.name}</Link>
                  </h2>
                  <p className={styles.gemMeta}>
                    {biz.category} in {biz.city} | Rating {biz.avg_rating.toFixed(1)} | {biz.review_count} reviews
                  </p>
                  <p className={styles.gemSummary}>
                    {biz.google_summary || biz.description || 'A high-potential local business worth exploring.'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.categoriesSection}>
        <div className={styles.container}>
          <p className={styles.kicker}>Category Momentum</p>
          <div className={styles.kickerUnderline} aria-hidden="true" />
          <div className={styles.categoriesGrid}>
            {categoryHighlights.map(([name, count]) => (
              <article key={name} className={styles.categoryCard}>
                <h3>{name}</h3>
                <p>{count} active listings</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value.toLocaleString()}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
