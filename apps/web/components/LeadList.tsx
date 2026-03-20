'use client';

import { useMemo } from 'react';
import { LeadCard } from './LeadCard';
import { FiltersPanel, type FilterState } from './FiltersPanel';
import type { Lead } from '@ekos/core';

export const DEFAULT_FILTER: FilterState = {
  minScore: 0,
  highConfidenceOnly: false,
  statuses: new Set(),
};

interface LeadListProps {
  leads: Lead[];
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onViewDetails: (lead: Lead) => void;
  onSelectAllScoreAbove7: () => void;
  onRetry?: (leadId: string) => void;
  onRetryAllFailed?: () => void;
  retryingId?: string | null;
  isRetryingAll?: boolean;
  isLoading?: boolean;
}

export function LeadList({
  leads,
  filter,
  onFilterChange,
  selectedIds,
  onToggle,
  onViewDetails,
  onSelectAllScoreAbove7,
  onRetry,
  onRetryAllFailed,
  retryingId,
  isRetryingAll,
  isLoading,
}: LeadListProps) {
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filter.minScore > 0 && (l.score?.score == null || l.score.score < filter.minScore)) return false;
      if (filter.highConfidenceOnly && (l.extracted?.confidence == null || l.extracted.confidence < 0.6)) return false;
      if (filter.statuses.size > 0 && !filter.statuses.has(l.status)) return false;
      return true;
    });
  }, [leads, filter]);

  const selectableHighScoreCount = leads.filter(
    (l) => l.status === 'completed' && l.score && l.score.score > 7
  ).length;
  const failedCount = leads.filter((l) => l.status === 'failed').length;

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
      }}
      className="lead-list-layout"
    >
      <aside style={{ flexShrink: 0, minWidth: 200 }}>
        <FiltersPanel
          filter={filter}
          onChange={onFilterChange}
          onSelectAllScoreAbove7={onSelectAllScoreAbove7}
          selectableHighScoreCount={selectableHighScoreCount}
        />
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {failedCount > 0 && onRetryAllFailed && (
            <button
              onClick={onRetryAllFailed}
              disabled={isRetryingAll}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-muted)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: isRetryingAll ? 'not-allowed' : 'pointer',
                opacity: isRetryingAll ? 0.6 : 1,
              }}
            >
              {isRetryingAll ? 'Retrying…' : `Retry all failed (${failedCount})`}
            </button>
          )}
        </div>

        {isLoading && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading leads...</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredLeads.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>
              No leads yet. Search for clinics to get started.
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onToggle={() => onToggle(lead.id)}
                onViewDetails={() => onViewDetails(lead)}
                onRetry={onRetry}
                isRetrying={retryingId === lead.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
