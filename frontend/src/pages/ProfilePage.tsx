import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { get, del } from '../services/api';
import logger from '../services/logger';
import { useAuth } from '../hooks/useAuth';
import type { ApiResponse, Business } from '../types';
import BusinessCard from '../components/BusinessCard';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, updateProfile, uploadProfileImage } = useAuth();
  const [favorites, setFavorites] = useState<Business[]>([]);
  const [recommendations, setRecommendations] = useState<Business[]>([]);
  const [recoFallback, setRecoFallback] = useState(false);
  const [favLoading, setFavLoading] = useState(true);
  const [recoLoading, setRecoLoading] = useState(true);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
  }, [user?.display_name, user?.profile_image_url]);

  useEffect(() => {
    get<ApiResponse<Business[]>>('/favorites')
      .then((resp) => setFavorites(resp.data ?? []))
      .catch((err) => logger.error('Failed to fetch favorites', err))
      .finally(() => setFavLoading(false));

    get<{ data: Business[] | null; meta?: { fallback?: boolean }; error: string | null }>('/recommendations')
      .then((resp) => {
        setRecommendations(resp.data ?? []);
        setRecoFallback(resp.meta?.fallback ?? false);
      })
      .catch((err) => {
        logger.warn('Recommendations not available', err);
        setRecoLoading(false);
      })
      .finally(() => setRecoLoading(false));
  }, []);

  async function unfavorite(businessId: number) {
    try {
      await del(`/favorites/${businessId}`);
      setFavorites((prev) => prev.filter((b) => b.id !== businessId));
    } catch (err) {
      logger.error('Failed to unfavorite', err);
    }
  }

  async function saveProfile() {
    setSaveError('');
    setSaveMessage('');
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setSaveError('Display name is required.');
      return;
    }

    try {
      await updateProfile({ display_name: trimmedName });
      setSaveMessage('Profile updated.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSaveError(msg ?? 'Unable to update profile.');
      logger.error('Failed to update profile', err);
    }
  }

  async function uploadAvatar() {
    if (!selectedImageFile) {
      setSaveError('Please choose an image file first.');
      return;
    }
    setSaveError('');
    setSaveMessage('');
    setUploadingImage(true);
    try {
      await uploadProfileImage(selectedImageFile);
      setSaveMessage('Profile picture updated.');
      setSelectedImageFile(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSaveError(msg ?? 'Unable to upload profile picture.');
      logger.error('Failed to upload profile image', err);
    } finally {
      setUploadingImage(false);
    }
  }

  const roleLabelClass =
    user?.role === 'admin' ? styles.roleAdmin
      : user?.role === 'business_owner' ? styles.roleOwner
        : styles.roleUser;

  const effectiveName = (user?.display_name && user.display_name.trim()) || user?.email || 'User';

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        {user?.profile_image_url ? (
          <img src={user.profile_image_url} alt={effectiveName} className={styles.avatarImage} />
        ) : (
          <div className={styles.avatar}>{effectiveName[0].toUpperCase()}</div>
        )}
        <div className={styles.userInfo}>
          <h1 className={styles.name}>{effectiveName}</h1>
          <span className={styles.email}>{user?.email}</span>
          <span className={`${styles.roleBadge} ${roleLabelClass}`}>{user?.role?.replace('_', ' ')}</span>
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile Settings</h2>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            Display Name
            <input
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </label>

          <label className={styles.fieldLabel}>
            Profile Picture
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.input}
              onChange={(e) => setSelectedImageFile(e.target.files?.[0] ?? null)}
            />
            <span className={styles.uploadHint}>
              Upload JPG, PNG, or WEBP (max 5 MB).
            </span>
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => void uploadAvatar()}
              disabled={uploadingImage}
            >
              {uploadingImage ? 'Uploading...' : 'Upload Picture'}
            </button>
          </label>
        </div>
        {saveMessage && <p className={styles.successMsg}>{saveMessage}</p>}
        {saveError && <p className={styles.errorMsg}>{saveError}</p>}
        <button className={styles.saveBtn} onClick={() => void saveProfile()}>
          Save Profile
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          My Favorites
          <span className={styles.count}>{favorites.length}</span>
        </h2>
        {favLoading ? (
          <p className={styles.status}>Loading...</p>
        ) : favorites.length === 0 ? (
          <p className={styles.status}>
            No saved businesses yet. Browse the <Link to="/" className={styles.link}>map</Link> and bookmark favorites.
          </p>
        ) : (
          <div className={styles.grid}>
            {favorites.map((biz) => (
              <div key={biz.id} className={styles.favItem}>
                <BusinessCard business={biz} />
                <button
                  className={styles.unfavBtn}
                  onClick={() => void unfavorite(biz.id)}
                  title="Remove from favorites"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Recommended for You
          {recoFallback && <span className={styles.fallbackNote}>(based on popular picks)</span>}
        </h2>
        {recoLoading ? (
          <p className={styles.status}>Loading recommendations...</p>
        ) : recommendations.length === 0 ? (
          <p className={styles.status}>Save 2+ favorites to unlock personalized recommendations.</p>
        ) : (
          <div className={styles.grid}>
            {recommendations.map((biz) => (
              <BusinessCard key={biz.id} business={biz} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.accountInfo}>
          <p className={styles.accountLine}><strong>Email:</strong> {user?.email}</p>
          <p className={styles.accountLine}><strong>Role:</strong> {user?.role?.replace('_', ' ')}</p>
          {user?.role === 'business_owner' && (
            <>
              <Link to="/owner/dashboard" className={styles.dashboardLink}>
                Go to Business Dashboard
              </Link>
              <Link to="/claim" className={styles.dashboardLink}>
                Claim an Existing Listing
              </Link>
            </>
          )}
          {user?.role === 'user' && (
            <Link to="/promote-business" className={styles.dashboardLink}>
              Promote Your Business
            </Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" className={styles.dashboardLink}>
              Go to Admin Dashboard
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
