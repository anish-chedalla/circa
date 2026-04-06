import { useMemo, useState } from 'react';

import { post } from '../services/api';
import type { ApiResponse } from '../types';
import MiniMap from '../components/MiniMap';
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
const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

interface OwnerListing {
  id: number;
}

interface DayHours {
  isClosed: boolean;
  open: string;
  close: string;
}

const DEFAULT_DAY_HOURS: DayHours = {
  isClosed: false,
  open: '09:00 AM',
  close: '05:00 PM',
};

function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const period = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const minuteLabel = minute.toString().padStart(2, '0');
      options.push(`${hour12}:${minuteLabel} ${period}`);
    }
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

export default function CreateBusinessListingPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('AZ');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');

  const [hoursByDay, setHoursByDay] = useState<Record<string, DayHours>>(
    Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }])),
  );

  const [previewLat, setPreviewLat] = useState<number | null>(null);
  const [previewLng, setPreviewLng] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const standardizedHours = useMemo(() => {
    const result: Hours = {};
    DAYS.forEach((day) => {
      const row = hoursByDay[day];
      result[day] = row.isClosed ? 'Closed' : `${row.open} - ${row.close}`;
    });
    return result;
  }, [hoursByDay]);

  function setDayValue(day: string, value: Partial<DayHours>) {
    setHoursByDay((prev) => ({ ...prev, [day]: { ...prev[day], ...value } }));
  }

  async function previewLocation() {
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const resp = await post<ApiResponse<{ lat: number; lng: number }>>('/owner/geocode-preview', {
        address: address || null,
        city,
        state,
        zip: zip || null,
      });
      if (resp.error || !resp.data) {
        setPreviewError(resp.error ?? 'Unable to preview this location.');
        setPreviewLat(null);
        setPreviewLng(null);
        return;
      }
      setPreviewLat(resp.data.lat);
      setPreviewLng(resp.data.lng);
    } catch {
      setPreviewError('Unable to preview this location.');
      setPreviewLat(null);
      setPreviewLng(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submitListing() {
    setMessage('');
    setError('');
    if (!name.trim() || !city.trim() || !state.trim()) {
      setError('Business name, city, and state are required.');
      return;
    }

    try {
      const resp = await post<ApiResponse<OwnerListing>>('/owner/listing', {
        name,
        category,
        address: address || null,
        city,
        state,
        zip: zip || null,
        phone: phone || null,
        website: website || null,
        description: description || null,
        hours: standardizedHours,
      });
      if (resp.error) {
        setError(resp.error);
        return;
      }
      setMessage('Listing submitted. Admin approval is required before it goes live.');
      setName('');
      setCategory(CATEGORIES[0]);
      setAddress('');
      setCity('');
      setState('AZ');
      setZip('');
      setPhone('');
      setWebsite('');
      setDescription('');
      setHoursByDay(Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }])));
      setPreviewLat(null);
      setPreviewLng(null);
      setPreviewError('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit listing.');
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Create your business listing</h1>
        <p className={styles.subtitle}>
          Fill out your business details. Use preview map to verify your location before submitting.
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
          <label className={styles.field}>State
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
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

        <section className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <h2>Location Preview</h2>
            <button className={styles.previewBtn} onClick={() => void previewLocation()} disabled={previewLoading}>
              {previewLoading ? 'Locating...' : 'Preview on Map'}
            </button>
          </div>
          {previewError && <p className={styles.error}>{previewError}</p>}
          {previewLat !== null && previewLng !== null && (
            <MiniMap lat={previewLat} lng={previewLng} name={name || 'Listing preview'} />
          )}
        </section>

        <section className={styles.hoursSection}>
          <h2>Hours of operation</h2>
          <div className={styles.hoursGrid}>
            {DAYS.map((day) => (
              <div key={day} className={styles.dayRow}>
                <div className={styles.dayHeader}>
                  <span>{day}</span>
                  <label className={styles.closedToggle}>
                    <input
                      type="checkbox"
                      checked={hoursByDay[day].isClosed}
                      onChange={(e) => setDayValue(day, { isClosed: e.target.checked })}
                    />
                    Closed
                  </label>
                </div>

                {!hoursByDay[day].isClosed && (
                  <div className={styles.timeRow}>
                    <select
                      value={hoursByDay[day].open}
                      onChange={(e) => setDayValue(day, { open: e.target.value })}
                    >
                      {TIME_OPTIONS.map((value) => <option key={`${day}-open-${value}`} value={value}>{value}</option>)}
                    </select>
                    <span>to</span>
                    <select
                      value={hoursByDay[day].close}
                      onChange={(e) => setDayValue(day, { close: e.target.value })}
                    >
                      {TIME_OPTIONS.map((value) => <option key={`${day}-close-${value}`} value={value}>{value}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {message && <p className={styles.success}>{message}</p>}
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.submitBtn} onClick={() => void submitListing()}>Submit Listing</button>
      </div>
    </main>
  );
}
