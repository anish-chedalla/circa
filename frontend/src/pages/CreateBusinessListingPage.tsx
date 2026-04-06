import { useEffect, useState } from 'react';

import { get, post } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse } from '../types';
import styles from './CreateBusinessListingPage.module.css';

type Hours = Record<string, string>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const CATEGORIES = [
  'Restaurants',
  'Coffee Shops',
  'Retail/Shopping',
  'Health & Wellness',
  'Arts & Entertainment',
  'Professional Services',
  'Home Services',
  'Fitness & Recreation',
];

interface OwnerListing {
  id: number;
  name: string;
  category: string;
  city: string;
  address: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  hours: Hours | null;
  listing_status: string;
}

export default function CreateBusinessListingPage() {
  const [existing, setExisting] = useState<OwnerListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState<Hours>({});

  useEffect(() => {
    get<ApiResponse<OwnerListing>>('/owner/listing')
      .then((resp) => {
        if (resp.data) setExisting(resp.data);
      })
      .catch((err) => logger.error('Failed to load owner listing', err))
      .finally(() => setLoading(false));
  }, []);

  function setDay(day: string, value: string) {
    setHours((prev) => ({ ...prev, [day]: value }));
  }

  async function submitListing() {
    setMessage('');
    setError('');
    if (!name.trim() || !city.trim()) {
      setError('Business name and city are required.');
      return;
    }

    const payloadHours: Hours = {};
    DAYS.forEach((day) => {
      const value = (hours[day] ?? '').trim();
      if (value) payloadHours[day] = value;
    });

    try {
      const resp = await post<ApiResponse<OwnerListing>>('/owner/listing', {
        name,
        category,
        address: address || null,
        city,
        zip: zip || null,
        phone: phone || null,
        website: website || null,
        description: description || null,
        hours: Object.keys(payloadHours).length > 0 ? payloadHours : null,
      });
      if (resp.error) {
        setError(resp.error);
        return;
      }
      if (resp.data) setExisting(resp.data);
      setMessage('Listing submitted. Admin approval is required before it goes live.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit listing.');
    }
  }

  if (loading) return <div className={styles.status}>Loading listing setup...</div>;

  if (existing) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Your listing status</h1>
          <p className={styles.statusPill}>{existing.listing_status.toUpperCase()}</p>
          <p className={styles.summary}>
            <strong>{existing.name}</strong> in {existing.city}
          </p>
          <p className={styles.note}>
            You already submitted a listing. Once approved, it appears publicly on Circa.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Create your business listing</h1>
        <p className={styles.subtitle}>
          Fill out your business details. An admin will review and approve your listing.
        </p>

        <div className={styles.formGrid}>
          <label className={styles.field}>Business Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Business Name" />
          </label>
          <label className={styles.field}>Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
          <label className={styles.field}>Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </label>
          <label className={styles.field}>City
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Phoenix" />
          </label>
          <label className={styles.field}>ZIP Code
            <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="85001" />
          </label>
          <label className={styles.field}>Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+16025551234" />
          </label>
          <label className={styles.field}>Website
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
          </label>
          <label className={`${styles.field} ${styles.full}`}>Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Tell customers what makes your business special."
            />
          </label>
        </div>

        <section className={styles.hoursSection}>
          <h2>Hours of operation</h2>
          <div className={styles.hoursGrid}>
            {DAYS.map((day) => (
              <label key={day} className={styles.field}>
                {day}
                <input
                  value={hours[day] ?? ''}
                  onChange={(e) => setDay(day, e.target.value)}
                  placeholder="9:00 AM - 5:00 PM"
                />
              </label>
            ))}
          </div>
        </section>

        {message && <p className={styles.success}>{message}</p>}
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.submitBtn} onClick={submitListing}>Submit Listing</button>
      </div>
    </main>
  );
}
