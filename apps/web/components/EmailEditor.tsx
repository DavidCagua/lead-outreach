'use client';

import { useState, useEffect } from 'react';
import type { Lead } from '@ekos/core';

interface EmailEditorProps {
  lead: Lead;
  onRegenerate: () => void;
  onApprove: (subject: string, body: string) => void;
  isRegenerating?: boolean;
}

export function EmailEditor({
  lead,
  onRegenerate,
  onApprove,
  isRegenerating,
}: EmailEditorProps) {
  const outreach = lead.outreach;
  const [subject, setSubject] = useState(outreach?.subject ?? '');
  const [body, setBody] = useState(outreach?.body ?? '');
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    setSubject(outreach?.subject ?? '');
    setBody(outreach?.body ?? '');
  }, [outreach?.subject, outreach?.body]);

  if (!outreach) return null;

  const handleApprove = () => {
    onApprove(subject, body);
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        background: 'var(--bg-card)',
        marginBottom: 16,
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <strong>{lead.name}</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-muted)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {isEditing ? 'Preview' : 'Edit'}
          </button>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-muted)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: isRegenerating ? 'not-allowed' : 'pointer',
              opacity: isRegenerating ? 0.6 : 1,
            }}
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Subject
        </label>
        {isEditing ? (
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
            }}
          />
        ) : (
          <div style={{ padding: '8px 0', fontSize: 14 }}>{subject}</div>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Body
        </label>
        {isEditing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              resize: 'vertical',
            }}
          />
        ) : (
          <div style={{ padding: '8px 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{body}</div>
        )}
      </div>
      <button
        onClick={handleApprove}
        style={{
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          background: 'var(--success)',
          color: 'white',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Approve
      </button>
    </div>
  );
}
