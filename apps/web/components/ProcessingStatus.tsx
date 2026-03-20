'use client';

import { useState, useEffect } from 'react';

interface RefinementStatus {
  attempt: number;
  maxAttempts: number;
  query: string;
  phase: string;
}

interface ProcessingStatusProps {
  hasLeads: boolean;
}

export function ProcessingStatus({ hasLeads }: ProcessingStatusProps) {
  const [status, setStatus] = useState<RefinementStatus | null>(null);

  useEffect(() => {
    if (!hasLeads) {
      setStatus(null);
      return;
    }
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/leads/refinement-status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        } else {
          setStatus(null);
        }
      } catch {
        setStatus(null);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [hasLeads]);

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
