/**
 * Claim Business page: search unclaimed businesses and submit ownership requests.
 */

import { useState, useRef, useEffect } from 'react';

import { get, post } from '../services/api';
import logger from '../services/logger';
import type { ApiResponse } from '../types';
import styles from './ClaimBusiness.module.css';

interface UnclaimedBusiness {
  id: number;
  name: string;
  category: string;
  city: string;
  address: string | null;
}

/**
 * Renders a search form for finding and claiming unclaimed business listings.
 */
export default function ClaimBusiness() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnclaimedBusiness[]>([]);
  const [searching, setSearching] = useState(false);
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [activeClaimId, setActiveClaimId] = useState<number | null>(null);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimDocs, setClaimDocs] = useState<File[]>([]);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await get<ApiResponse<UnclaimedBusiness[]>>(`/claims/search?name=${encodeURIComponent(query)}`);
        setResults(resp.data ?? []);
      } catch (err) {
        logger.error('Search failed', err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  /** Submit a claim for the given business. */
  async function submitClaim(businessId: number) {
    setSubmittingId(businessId);
    try {
      const formData = new FormData();
      formData.append('business_id', String(businessId));
      if (claimMessage.trim()) {
        formData.append('claim_message', claimMessage.trim());
      }
      for (const doc of claimDocs) {
        formData.append('proof_documents', doc);
      }

      const resp = await post<ApiResponse<{ id: number }>>('/claims', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.error) {
        setMessages((prev) => ({ ...prev, [businessId]: resp.error! }));
        return;
      }
      setClaimed((prev) => ({ ...prev, [businessId]: true }));
      setMessages((prev) => ({ ...prev, [businessId]: 'Claim submitted! An admin will review your request.' }));
      setActiveClaimId(null);
      setClaimMessage('');
      setClaimDocs([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setMessages((prev) => ({ ...prev, [businessId]: msg ?? 'Failed to submit claim.' }));
      logger.error('Claim submission failed', err);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Claim Your Business</h1>
      <p className={styles.subtitle}>
        Search for your business and submit a claim. An admin will review and approve your request.
      </p>

      <input
        className={styles.search}
        type="text"
        placeholder="Search by business name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {searching && <p className={styles.status}>Searching…</p>}

      {!searching && query.trim() && results.length === 0 && (
        <p className={styles.status}>No unclaimed businesses found matching "{query}".</p>
      )}

      <div className={styles.results}>
        {results.map((biz) => (
          <div key={biz.id} className={styles.bizRow}>
            <div className={styles.bizInfo}>
              <span className={styles.bizName}>{biz.name}</span>
              <span className={styles.bizMeta}>{biz.category} · {biz.city}</span>
              {biz.address && <span className={styles.bizAddress}>{biz.address}</span>}
            </div>
            <div className={styles.bizAction}>
              {messages[biz.id] && (
                <p className={claimed[biz.id] ? styles.successMsg : styles.errorMsg}>
                  {messages[biz.id]}
                </p>
              )}
              {!claimed[biz.id] && (
                <>
                  {activeClaimId === biz.id ? (
                    <div className={styles.claimForm}>
                      <label className={styles.fieldLabel}>
                        Message to Admin
                        <textarea
                          className={styles.messageInput}
                          placeholder="Describe your ownership (role, contact, or website linkage)."
                          value={claimMessage}
                          onChange={(e) => setClaimMessage(e.target.value)}
                          maxLength={2000}
                        />
                      </label>
                      <label className={styles.fieldLabel}>
                        Proof Documents (PDF)
                        <input
                          className={styles.docInput}
                          type="file"
                          accept="application/pdf,.pdf"
                          multiple
                          onChange={(e) => setClaimDocs(Array.from(e.target.files ?? []))}
                        />
                      </label>
                      {claimDocs.length > 0 && (
                        <p className={styles.docCount}>{claimDocs.length} document(s) selected</p>
                      )}
                      <div className={styles.claimActions}>
                        <button
                          className={styles.claimBtn}
                          onClick={() => void submitClaim(biz.id)}
                          disabled={submittingId === biz.id}
                        >
                          {submittingId === biz.id ? 'Submitting...' : 'Submit Claim'}
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => {
                            setActiveClaimId(null);
                            setClaimMessage('');
                            setClaimDocs([]);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className={styles.claimBtn}
                      onClick={() => {
                        setActiveClaimId(biz.id);
                        setClaimMessage('');
                        setClaimDocs([]);
                      }}
                    >
                      Claim This Business
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
