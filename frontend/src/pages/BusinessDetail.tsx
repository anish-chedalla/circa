/**
 * Business Detail page — shows full info, reviews, deals, bookmark, and review modal.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { get, post, del } from '../services/api';
import logger from '../services/logger';
import { useAuth } from '../hooks/useAuth';
import type { ApiResponse, BusinessDetail as BusinessDetailType } from '../types';
import StarRating from '../components/StarRating';
import DealCard from '../components/DealCard';
import ReviewCard from '../components/ReviewCard';
import BusinessHours from '../components/BusinessHours';
import MiniMap from '../components/MiniMap';
import ReviewModal from '../components/ReviewModal';
import styles from './BusinessDetail.module.css';

/**
 * Renders a full business detail view with map, reviews, deals, and bookmark.
 */
export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [business, setBusiness] = useState<BusinessDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    get<ApiResponse<BusinessDetailType>>(`/businesses/${id}`)
      .then((resp) => {
        if (!resp.data) { setNotFound(true); return; }
        setBusiness(resp.data);
      })
      .catch((err) => { logger.error('Failed to fetch business', err); setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  /** Toggle favorite status for the business. */
  async function toggleFavorite() {
    if (!user) { window.location.href = '/login'; return; }
    try {
      if (isFavorited) {
        await del(`/favorites/${id}`);
        setIsFavorited(false);
      } else {
        await post(`/favorites/${id}`);
        setIsFavorited(true);
      }
    } catch (err) {
      logger.error('Failed to toggle favorite', err);
    }
  }

  /** Refresh reviews after a new review is submitted. */
  function handleReviewSubmitted() {
    setShowReviewModal(false);
    if (!id) return;
    get<ApiResponse<BusinessDetailType>>(`/businesses/${id}`)
      .then((resp) => { if (resp.data) setBusiness(resp.data); })
      .catch((err) => logger.error('Failed to refresh business', err));
  }

  if (loading) return <div className={styles.status}>Loading…</div>;
  if (notFound || !business) {
    return (
      <div className={styles.status}>
        <h2>Business not found</h2>
        <Link to="/" className={styles.backLink}>← Back to map</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.backLink}>← Back to map</Link>

      <div className={styles.layout}>
        <div className={styles.left}>
          <header className={styles.header}>
            <div className={styles.titleRow}>
              <h1 className={styles.name}>{business.name}</h1>
              <button
                className={`${styles.bookmarkBtn} ${isFavorited ? styles.bookmarked : ''}`}
                onClick={toggleFavorite}
                title={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              >
                {isFavorited ? '♥' : '♡'}
              </button>
            </div>
            <span className={styles.category}>{business.category}</span>
            <div className={styles.ratingRow}>
              <StarRating rating={business.avg_rating} size="1.1rem" />
              <span className={styles.ratingNum}>{business.avg_rating.toFixed(1)}</span>
              <span className={styles.reviewCount}>({business.review_count} reviews)</span>
            </div>
          </header>

          <section className={styles.infoSection}>
            {business.address && <p className={styles.infoLine}>📍 {business.address}, {business.city} {business.zip}</p>}
            {business.phone && <p className={styles.infoLine}>📞 <a href={`tel:${business.phone}`} className={styles.link}>{business.phone}</a></p>}
            {business.website && <p className={styles.infoLine}>🌐 <a href={business.website} target="_blank" rel="noreferrer" className={styles.link}>{business.website.replace(/^https?:\/\//, '')}</a></p>}
            {business.description && <p className={styles.description}>{business.description}</p>}
          </section>

          {business.hours && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Hours</h2>
              <BusinessHours hours={business.hours} />
            </section>
          )}

          {business.deals.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Active Deals</h2>
              {business.deals.map((deal) => <DealCard key={deal.id} deal={deal} />)}
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.reviewsHeader}>
              <h2 className={styles.sectionTitle}>Reviews ({business.reviews.length})</h2>
              {user ? (
                <button className={styles.reviewBtn} onClick={() => setShowReviewModal(true)}>
                  Leave a Review
                </button>
              ) : (
                <Link to="/login" className={styles.reviewBtn}>Login to review</Link>
              )}
            </div>
            {business.reviews.length === 0
              ? <p className={styles.noReviews}>No reviews yet — be the first!</p>
              : business.reviews.map((r) => <ReviewCard key={r.id} review={r} />)
            }
          </section>
        </div>

        <div className={styles.right}>
          {business.lat !== null && business.lng !== null && (
            <MiniMap lat={business.lat} lng={business.lng} name={business.name} />
          )}
        </div>
      </div>

      {showReviewModal && (
        <ReviewModal
          businessId={Number(id)}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  );
}
