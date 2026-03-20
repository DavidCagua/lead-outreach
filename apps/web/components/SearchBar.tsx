'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => Promise<void>;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsLoading(true);
    try {
      await onSearch(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        type="text"
        placeholder="Search clinics (e.g. 'dental clinics in Austin')"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        style={{
          flex: 1,
          padding: '10px 14px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text)',
          fontSize: 14,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        style={{
          padding: '10px 20px',
          borderRadius: 'var(--radius)',
          border: 'none',
          background: 'var(--accent)',
          color: 'white',
          fontWeight: 500,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
}
