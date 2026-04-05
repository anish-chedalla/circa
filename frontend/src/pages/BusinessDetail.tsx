import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

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

export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
        if (!resp.data) {
          setNotFound(true);
          return;
        }
        setBusiness(resp.data);
      })
      .catch((err) => {
        logger.error('Failed to fetch business', err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleFavorite() {
    if (!user) {
      navigate('/login');
      return;
    }
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

  function handleReviewSubmitted() {
    setShowReviewModal(false);
    if (!id) return;
    get<ApiResponse<BusinessDetailType>>(`/businesses/${id}`)
      .then((resp) => {
        if (resp.data) setBusiness(resp.data);
      })
      .catch((err) => logger.error('Failed to refresh business', err));
  }

  if (loading) return <div className={styles.status}>Loading...</div>;

  if (notFound || !business) {
    return (
      <div className={styles.status}>
        <h2>Business not found</h2>
        <Link to="/" className={styles.backLink}>Back to map</Link>
      </div>
    );
  }

  const heroImage = business.google_photo_url || '/about/small-business.jpg';
  const summary = business.google_summary || business.description;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <img src={heroImage} alt={business.name} className={styles.heroImage} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <Link to="/" className={styles.backLink}>Back to map</Link>
          <div className={styles.titleRow}>
            <h1 className={styles.name}>{business.name}</h1>
            <button
              className={`${styles.bookmarkBtn} ${isFavorited ? styles.bookmarked : ''}`}
              onClick={toggleFavorite}
              title={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            >
              {isFavorited ? 'Saved' : 'Save'}
            </button>
          </div>
          <p className={styles.meta}>
            {business.category} | {business.city}
          </p>
          <div className={styles.ratingRow}>
            <StarRating rating={business.avg_rating} size="1.1rem" />
            <span>{business.avg_rating.toFixed(1)}</span>
            <span>({business.review_count} reviews)</span>
          </div>
          {summary && <p className={styles.summary}>{summary}</p>}
        </div>
      </section>

      <section className={styles.contentSection}>
        <div className={styles.container}>
          <div className={styles.layout}>
            <div className={styles.left}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Details</h2>
                {business.address && (
                  <p className={styles.infoLine}>
                    <span className={styles.label}>Address:</span> {business.address}, {business.city} {business.zip}
                  </p>
                )}
                {business.phone && (
                  <p className={styles.infoLine}>
                    <span className={styles.label}>Phone:</span> <a href={`tel:${business.phone}`}>{business.phone}</a>
                  </p>
                )}
                {business.website && (
                  <p className={styles.infoLine}>
                    <span className={styles.label}>Website:</span>{' '}
                    <a href={business.website} target="_blank" rel="noreferrer">
                      {business.website.replace(/^https?:\/\//, '')}
                    </a>
                  </p>
                )}
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
                  ? <p className={styles.noReviews}>No reviews yet. Be the first.</p>
                  : business.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
              </section>
            </div>

            <aside className={styles.right}>
              {business.lat !== null && business.lng !== null && (
                <MiniMap lat={business.lat} lng={business.lng} name={business.name} />
              )}
            </aside>
          </div>
        </div>
      </section>

      {showReviewModal && (
        <ReviewModal
          businessId={Number(id)}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </main>
  );
}
