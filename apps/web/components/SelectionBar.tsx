'use client';

interface SelectionBarProps {
  selectedCount: number;
  onGenerateOutreach: () => void;
  isGenerating: boolean;
}

export function SelectionBar({
  selectedCount,
  onGenerateOutreach,
  isGenerating,
}: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        zIndex: 50,
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
        {selectedCount} selected
      </span>
      <button
        onClick={onGenerateOutreach}
        disabled={isGenerating}
        style={{
          padding: '10px 20px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: 'var(--accent)',
          color: 'white',
          fontWeight: 500,
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          opacity: isGenerating ? 0.7 : 1,
        }}
      >
        {isGenerating ? 'Generating...' : 'Generate Outreach'}
      </button>
    </div>
  );
}
