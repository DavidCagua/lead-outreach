'use client';

import { useState, useEffect, useRef } from 'react';

interface RefinementStatus {
  attempt: number;
  maxAttempts: number;
  query: string;
  phase: string;
}

interface ProcessingStatusProps {
  campaignId: string | null;
}

export function ProcessingStatus({ campaignId }: ProcessingStatusProps) {
  const [status, setStatus] = useState<RefinementStatus | null>(null);

  const campaignIdRef = useRef(campaignId);
  campaignIdRef.current = campaignId;

  useEffect(() => {
    if (!campaignId) {
      setStatus(null);
      return;
    }
    const fetchStatus = async () => {
      const id = campaignId;
      try {
        const res = await fetch(
          `/api/leads/refinement-status?campaignId=${encodeURIComponent(id)}`
        );
        if (campaignIdRef.current !== id) return;
        if (res.ok) {
          const data = await res.json();
          if (campaignIdRef.current !== id) return;
          setStatus(data);
        } else {
          setStatus(null);
        }
      } catch {
        if (campaignIdRef.current !== id) return;
        setStatus(null);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [campaignId]);

  if (!status) return null;

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}
    >
      Refining results (Attempt {status.attempt} / {status.maxAttempts})
      {status.query && (
        <span style={{ marginLeft: 8, color: 'var(--text-dim)' }}>
          — {status.query}
        </span>
      )}
    </div>
  );
}
