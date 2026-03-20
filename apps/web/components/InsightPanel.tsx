'use client';

import type { Lead } from '@ekos/core';

interface InsightPanelProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InsightPanel({ lead, isOpen, onClose }: InsightPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(400px, 100vw)',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          zIndex: 101,
          padding: 24,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Lead Details</h3>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Close
          </button>
        </div>

        {lead && (
          <>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{lead.name}</div>
              {lead.address && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{lead.address}</div>
              )}
              {lead.website && (
                <a
                  href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 14,
                    color: 'var(--accent)',
                    marginTop: 6,
                    display: 'inline-block',
                    wordBreak: 'break-all',
                  }}
                >
                  {lead.website}
                </a>
              )}
            </div>

            {lead.extracted && (
              <>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Services
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                    {lead.extracted.services.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Pain Points
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                    {lead.extracted.pain_points.length > 0 ? (
                      lead.extracted.pain_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))
                    ) : (
                      <li style={{ color: 'var(--text-dim)' }}>None identified</li>
                    )}
                  </ul>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Online booking:</span>{' '}
                    {lead.extracted.has_online_booking ? 'Yes' : 'No'}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Clinic size:</span>{' '}
                    {lead.extracted.clinic_size}
                  </div>
                </div>
              </>
            )}

            {lead.score?.reason && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                  AI Reasoning
                </div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{lead.score.reason}</div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
