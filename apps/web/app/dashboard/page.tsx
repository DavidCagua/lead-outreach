'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { LeadList, DEFAULT_FILTER } from '@/components/LeadList';
import { SelectionBar } from '@/components/SelectionBar';
import { EmailEditor } from '@/components/EmailEditor';
import { InsightPanel } from '@/components/InsightPanel';
import type { Lead } from '@ekos/core';

const POLL_INTERVAL_MS = 3000;

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [insightLead, setInsightLead] = useState<Lead | null>(null);
  const [insightOpen, setInsightOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const handleSearch = async (query: string) => {
    const res = await fetch('/api/leads/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (res.ok) await fetchLeads();
  };

  const handleToggleLead = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllScoreAbove7 = () => {
    const highScoreIds = leads
      .filter((l) => l.status === 'completed' && l.score && l.score.score > 7)
      .map((l) => l.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      highScoreIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        await fetchLeads();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async (leadId: string) => {
    setRetryingId(leadId);
    try {
      const res = await fetch('/api/leads/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) await fetchLeads();
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllFailed = async () => {
    const failedIds = leads.filter((l) => l.status === 'failed').map((l) => l.id);
    if (failedIds.length === 0) return;
    setIsRetryingAll(true);
    try {
      const res = await fetch('/api/leads/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: failedIds }),
      });
      if (res.ok) await fetchLeads();
    } finally {
      setIsRetryingAll(false);
    }
  };

  const handleViewDetails = (lead: Lead) => {
    setInsightLead(lead);
    setInsightOpen(true);
  };

  const handleRegenerate = async (leadId: string) => {
    setRegeneratingId(leadId);
    try {
      const res = await fetch('/api/outreach/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) await fetchLeads();
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleApprove = (_subject: string, _body: string) => {
    // Placeholder - no backend yet
  };

  const handleApproveAndSend = () => {
    console.log('Approve & Send (stub)');
  };

  const handleSaveDraft = () => {
    console.log('Save Draft (stub)');
  };

  const leadsWithOutreach = leads.filter(
    (l) => l.status === 'completed' && l.outreach
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Ekos — Sales Outreach</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
        Discover clinics, enrich with AI, and generate personalized outreach emails.
      </p>

      <SearchBar onSearch={handleSearch} />

      {leads.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <ProcessingStatus hasLeads={leads.length > 0} />
        </div>
      )}

      <h2 style={{ fontSize: 18, marginTop: 24, marginBottom: 12 }}>Step 1 — Lead Review</h2>
      <LeadList
        leads={leads}
        filter={filter}
        onFilterChange={setFilter}
        selectedIds={selectedIds}
        onToggle={handleToggleLead}
        onViewDetails={handleViewDetails}
        onSelectAllScoreAbove7={handleSelectAllScoreAbove7}
        onRetry={handleRetry}
        onRetryAllFailed={handleRetryAllFailed}
        retryingId={retryingId}
        isRetryingAll={isRetryingAll}
        isLoading={false}
      />

      <SelectionBar
        selectedCount={selectedIds.size}
        onGenerateOutreach={handleApproveSelected}
        isGenerating={isGenerating}
      />

      {isGenerating && (
        <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 14 }}>
          Generating outreach emails...
        </div>
      )}

      {leadsWithOutreach.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>
            Step 2 — Outreach Review
          </h2>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <aside style={{ minWidth: 200, flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Selected leads
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {leadsWithOutreach.map((lead) => (
                  <li key={lead.id} style={{ marginBottom: 4 }}>{lead.name}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flex: 1, minWidth: 300 }}>
              {leadsWithOutreach.map((lead) => (
                <EmailEditor
                  key={lead.id}
                  lead={lead}
                  onRegenerate={() => handleRegenerate(lead.id)}
                  onApprove={handleApprove}
                  isRegenerating={regeneratingId === lead.id}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button
              onClick={handleApproveAndSend}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius)',
                border: 'none',
                background: 'var(--success)',
                color: 'white',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Approve & Send
            </button>
            <button
              onClick={handleSaveDraft}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-muted)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Save Draft
            </button>
          </div>
        </>
      )}

      <InsightPanel
        lead={insightLead}
        isOpen={insightOpen}
        onClose={() => setInsightOpen(false)}
      />
    </div>
  );
}
