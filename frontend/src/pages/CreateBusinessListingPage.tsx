import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';

import { get, post, put } from '../services/api';
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
const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];
const MAP_DEFAULT: [number, number] = [33.4484, -112.0740];

interface OwnerListing {
  id: number;
  name: string;
  category: string;
  address: string | null;
  city: string;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  hours: Record<string, string> | null;
  listing_status: string;
  rejection_reason?: string | null;
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

function parseHours(hours: Record<string, string> | null): Record<string, DayHours> {
  const result: Record<string, DayHours> = Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }]));
  if (!hours) return result;
  for (const day of DAYS) {
    const value = hours[day];
    if (!value) continue;
    if (value.toLowerCase() === 'closed') {
      result[day] = { ...result[day], isClosed: true };
      continue;
    }
    const [open, close] = value.split(' - ');
    if (open && close) {
      result[day] = { isClosed: false, open, close };
    }
  }
  return result;
}

interface PickerProps {
  position: [number, number];
  onPick: (lat: number, lng: number) => void;
}

function MapPicker({ position, onPick }: PickerProps) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return <CircleMarker center={position} radius={8} pathOptions={{ color: '#3b4cc0', fillColor: '#3b4cc0', fillOpacity: 0.8 }} />;
}

export default function CreateBusinessListingPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [draft, setDraft] = useState<OwnerListing | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('AZ');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLat, setSelectedLat] = useState(MAP_DEFAULT[0]);
  const [selectedLng, setSelectedLng] = useState(MAP_DEFAULT[1]);
  const [mapResolving, setMapResolving] = useState(false);

  const [hoursByDay, setHoursByDay] = useState<Record<string, DayHours>>(
    Object.fromEntries(DAYS.map((d) => [d, { ...DEFAULT_DAY_HOURS }])),
  );

  useEffect(() => {
    get<ApiResponse<OwnerListing>>('/owner/listing')
      .then((resp) => {
        if (!resp.data) return;
        const listing = resp.data;
        setDraft(listing);
        setName(listing.name ?? '');
        setCategory(listing.category ?? CATEGORIES[0]);
        setAddress(listing.address ?? '');
        setCity(listing.city ?? '');
        setState(listing.state ?? 'AZ');
        setZip(listing.zip ?? '');
        setPhone(listing.phone ?? '');
        setWebsite(listing.website ?? '');
        setDescription(listing.description ?? '');
        setHoursByDay(parseHours(listing.hours));
        if (listing.lat !== null && listing.lng !== null) {
          setSelectedLat(listing.lat);
          setSelectedLng(listing.lng);
        }
      })
      .finally(() => setLoadingDraft(false));
  }, []);

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

  async function handleMapPick(lat: number, lng: number) {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setMapResolving(true);
    setError('');
    try {
      const resp = await post<ApiResponse<{ address: string | null; city: string; state: string; zip: string | null }>>(
        '/owner/reverse-geocode',
        { lat, lng },
      );
      if (resp.data) {
        setAddress(resp.data.address ?? '');
        setCity(resp.data.city ?? '');
        setState(resp.data.state ?? 'AZ');
        setZip(resp.data.zip ?? '');
      }
    } catch {
      setError('Could not reverse-populate address from selected map point.');
    } finally {
      setMapResolving(false);
    }
  }

  async function submitListing() {
    setMessage('');
    setError('');
    if (!name.trim() || !city.trim() || !state.trim()) {
      setError('Business name, city, and state are required.');
      return;
    }

    const payload = {
      name,
      category,
      address: address || null,
      city,
      state,
      zip: zip || null,
      lat: selectedLat,
      lng: selectedLng,
      phone: phone || null,
      website: website || null,
      description: description || null,
      hours: standardizedHours,
    };

    try {
      const resp = draft
        ? await put<ApiResponse<OwnerListing>>(`/owner/listing/${draft.id}/resubmit`, payload)
        : await post<ApiResponse<OwnerListing>>('/owner/listing', payload);
      if (resp.error) {
        setError(resp.error);
        return;
      }
      setMessage(draft ? 'Revisions submitted for admin review.' : 'Listing submitted for admin review.');
      if (resp.data) setDraft(resp.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit listing.');
    }
  }

  if (loadingDraft) {
    return <main className={styles.page}><div className={styles.container}>Loading...</div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>{draft ? 'Revise your business listing' : 'Create your business listing'}</h1>
        <p className={styles.subtitle}>
          Select location on map first. Address fields auto-populate so your listing appears in the correct place.
        </p>

        {draft?.listing_status === 'rejected' && draft.rejection_reason && (
          <div className={styles.error}>
            <strong>Rejected:</strong> {draft.rejection_reason}
          </div>
        )}

        <section className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <h2>Pick Business Location</h2>
            {mapResolving && <span className={styles.smallText}>Updating address from map...</span>}
          </div>
          <div className={styles.mapWrap}>
            <MapContainer center={[selectedLat, selectedLng]} zoom={13} className={styles.map}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapPicker position={[selectedLat, selectedLng]} onPick={(lat, lng) => void handleMapPick(lat, lng)} />
            </MapContainer>
          </div>
        </section>

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
        <button className={styles.submitBtn} onClick={() => void submitListing()}>
          {draft ? 'Submit Revisions' : 'Submit Listing'}
        </button>
      </div>
    </main>
  );
}
