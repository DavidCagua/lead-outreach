'use client';

import type { LeadStatus } from '@ekos/core';

export interface FilterState {
  minScore: number;
  highConfidenceOnly: boolean;
  statuses: Set<LeadStatus>;
}

interface FiltersPanelProps {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  onSelectAllScoreAbove7: () => void;
  selectableHighScoreCount: number;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export function FiltersPanel({
  filter,
  onChange,
  onSelectAllScoreAbove7,
  selectableHighScoreCount,
}: FiltersPanelProps) {
  const toggleStatus = (s: LeadStatus) => {
    const next = new Set(filter.statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...filter, statuses: next });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 200,
      }}
    >
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}
        >
          Min score
        </label>
        <input
          type="range"
          min={0}
          max={10}
          value={filter.minScore}
          onChange={(e) =>
            onChange({ ...filter, minScore: Number(e.target.value) })
          }
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filter.minScore}+
        </span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={filter.highConfidenceOnly}
          onChange={(e) =>
            onChange({ ...filter, highConfidenceOnly: e.target.checked })
          }
          style={{ accentColor: 'var(--accent)' }}
        />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>
          High confidence only
        </span>
      </label>

      <div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 8,
          }}
        >
          Status
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STATUS_OPTIONS.map(({ value, label }) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filter.statuses.has(value)}
                onChange={() => toggleStatus(value)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={onSelectAllScoreAbove7}
        disabled={selectableHighScoreCount === 0}
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-muted)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: 13,
          cursor: selectableHighScoreCount === 0 ? 'not-allowed' : 'pointer',
          opacity: selectableHighScoreCount === 0 ? 0.5 : 1,
        }}
      >
        Select all score &gt; 7
      </button>
    </div>
  );
}
