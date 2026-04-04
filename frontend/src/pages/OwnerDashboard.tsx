/**
 * Business Owner Dashboard: edit business info and manage deals.
 * Requires business_owner or admin role.
 */

import { useEffect, useState } from 'react';

import { get, put, post, del } from '../services/api';
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

interface OwnerBusiness {
  id: number;
  name: string;
  category: string;
  city: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  hours: Record<string, string> | null;
  avg_rating: number;
  review_count: number;
  deals: DealItem[];
}

/**
 * Renders the owner dashboard with business editor and deal management.
 */
export default function OwnerDashboard() {
  const [business, setBusiness] = useState<OwnerBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [noBusiness, setNoBusiness] = useState(false);

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

  useEffect(() => {
    get<ApiResponse<OwnerBusiness>>('/owner/business')
      .then((resp) => {
        if (!resp.data) { setNoBusiness(true); return; }
        setBusiness(resp.data);
        setDesc(resp.data.description ?? '');
        setPhone(resp.data.phone ?? '');
        setWebsite(resp.data.website ?? '');
      })
      .catch(() => setNoBusiness(true))
      .finally(() => setLoading(false));
  }, []);

  async function saveBusiness() {
    setSaveMsg(''); setSaveError('');
    try {
      const resp = await put<ApiResponse<OwnerBusiness>>('/owner/business', { description: desc, phone, website });
      if (resp.error) { setSaveError(resp.error); return; }
      if (resp.data) setBusiness({ ...business!, ...resp.data });
      setSaveMsg('Saved successfully!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSaveError(msg ?? 'Failed to save.');
      logger.error('Save business failed', err);
    }
  }

  async function postDeal() {
    setDealMsg(''); setDealError('');
    if (!dealTitle.trim()) { setDealError('Title is required.'); return; }
    try {
      const resp = await post<ApiResponse<DealItem>>('/owner/deals', {
        title: dealTitle, description: dealDesc || null,
        expiry_date: dealExpiry || null,
      });
      if (resp.error) { setDealError(resp.error); return; }
      if (resp.data) setBusiness((prev) => prev ? { ...prev, deals: [resp.data!, ...prev.deals] } : prev);
      setDealTitle(''); setDealDesc(''); setDealExpiry('');
      setDealMsg('Deal posted!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setDealError(msg ?? 'Failed to post deal.');
      logger.error('Post deal failed', err);
    }
  }

  async function removeDeal(dealId: number) {
    try {
      await del(`/owner/deals/${dealId}`);
      setBusiness((prev) => prev ? { ...prev, deals: prev.deals.filter((d) => d.id !== dealId) } : prev);
    } catch (err) { logger.error('Remove deal failed', err); }
  }

  if (loading) return <div className={styles.status}>Loading…</div>;
  if (noBusiness || !business) {
    return (
      <div className={styles.status}>
        <p>You haven't claimed a business yet.</p>
        <a href="/claim" className={styles.claimLink}>Claim a Business →</a>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.bizName}>{business.name}</h1>
        <span className={styles.category}>{business.category} · {business.city}</span>
        <span className={styles.stats}>★ {business.avg_rating.toFixed(1)} · {business.review_count} reviews</span>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Edit Business Info</h2>
        <label className={styles.fieldLabel}>Description
          <textarea className={styles.textarea} value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} />
        </label>
        <label className={styles.fieldLabel}>Phone
          <input className={styles.input} type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+16025551234" />
        </label>
        <label className={styles.fieldLabel}>Website
          <input className={styles.input} type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />
        </label>
        {saveMsg && <p className={styles.successMsg}>{saveMsg}</p>}
        {saveError && <p className={styles.errorMsg}>{saveError}</p>}
        <button className={styles.saveBtn} onClick={saveBusiness}>Save Changes</button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active Deals ({business.deals.length})</h2>
        {business.deals.length === 0 && <p className={styles.noItems}>No active deals. Post one below!</p>}
        {business.deals.map((deal) => (
          <div key={deal.id} className={styles.dealRow}>
            <div className={styles.dealInfo}>
              <strong>{deal.title}</strong>
              {deal.description && <span>{deal.description}</span>}
              {deal.expiry_date && <span className={styles.expiry}>Expires {deal.expiry_date}</span>}
            </div>
            <button className={styles.deleteBtn} onClick={() => removeDeal(deal.id)}>Remove</button>
          </div>
        ))}

        <div className={styles.newDealForm}>
          <h3 className={styles.subTitle}>Post a New Deal</h3>
          <label className={styles.fieldLabel}>Title *
            <input className={styles.input} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} maxLength={100} placeholder="20% Off First Visit" />
          </label>
          <label className={styles.fieldLabel}>Description
            <textarea className={styles.textarea} rows={2} value={dealDesc} onChange={(e) => setDealDesc(e.target.value)} placeholder="Details about the deal…" />
          </label>
          <label className={styles.fieldLabel}>Expiry Date (optional)
            <input className={styles.input} type="date" value={dealExpiry} onChange={(e) => setDealExpiry(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </label>
          {dealMsg && <p className={styles.successMsg}>{dealMsg}</p>}
          {dealError && <p className={styles.errorMsg}>{dealError}</p>}
          <button className={styles.saveBtn} onClick={postDeal}>Post Deal</button>
        </div>
      </section>
    </div>
  );
}
