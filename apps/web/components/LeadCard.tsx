'use client';

import type { Lead } from '@ekos/core';

interface LeadCardProps {
  lead: Lead;
  selected: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  showCheckbox?: boolean;
}

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  processing: '⏳',
  completed: '✔',
  failed: '❌',
};

const PROCESSING_PHASE_LABELS: Record<string, string> = {
  fetching_website: 'Fetching website',
  crawling: 'Crawling site',
  extracting: 'Extracting info',
  scoring: 'Scoring lead',
};

export function LeadCard({
  lead,
  selected,
  onToggle,
  onViewDetails,
  showCheckbox = true,
}: LeadCardProps) {
  const score = lead.score?.score;
  const reason = lead.score?.reason;
  const status = lead.status;

  const scoreColor =
    score == null ? 'var(--text-dim)' :
    score >= 7 ? 'var(--success)' :
    score >= 5 ? 'var(--warning)' :
    'var(--error)';

  const servicesPreview = lead.extracted?.services?.slice(0, 3) ?? [];
  const painPointsPreview = lead.extracted?.pain_points?.slice(0, 2) ?? [];

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        background: selected ? 'var(--bg-card)' : 'var(--bg-card)',
        opacity: selected ? 1 : 0.95,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        boxShadow: 'var(--shadow)',
      }}
    >
      {showCheckbox && lead.status === 'completed' && lead.score && lead.score.score >= 5 && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ marginTop: 4, accentColor: 'var(--accent)' }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16 }}>{lead.name}</strong>
          {score != null && (
            <span
              style={{
                background: scoreColor,
                color: score >= 5 ? '#0f172a' : 'white',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {score}/10
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {STATUS_ICONS[status] ?? ''}{' '}
            {status === 'processing' && lead.processingPhase
              ? PROCESSING_PHASE_LABELS[lead.processingPhase] ?? status
              : status}
          </span>
        </div>
        {lead.address && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
            {lead.address}
          </div>
        )}
        {reason && (
          <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 8 }}>
            <strong>Reason:</strong> {reason}
          </div>
        )}
        {(servicesPreview.length > 0 || painPointsPreview.length > 0) && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {servicesPreview.length > 0 && (
              <span>Services: {servicesPreview.join(', ')}{servicesPreview.length < (lead.extracted?.services?.length ?? 0) ? '…' : ''}</span>
            )}
            {servicesPreview.length > 0 && painPointsPreview.length > 0 && ' • '}
            {painPointsPreview.length > 0 && (
              <span>Pain points: {painPointsPreview.join(', ')}{painPointsPreview.length < (lead.extracted?.pain_points?.length ?? 0) ? '…' : ''}</span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onViewDetails}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-muted)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            View details
          </button>
        </div>
        {lead.status === 'failed' && (
          <div style={{ fontSize: 13, color: 'var(--error)', marginTop: 8 }}>
            {lead.failureReason || 'Reason not recorded'}
          </div>
        )}
      </div>
    </div>
  );
}
