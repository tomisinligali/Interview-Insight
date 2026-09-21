'use client';

import { useCallback, useEffect, useState } from 'react';

const API_BASE = 'https://interview-insight-sooty.vercel.app';
const PAGE_SIZE = 10;

const SOURCE_TYPES = ['PASTE', 'TXT', 'DOCX', 'SRT', 'VTT'] as const;

interface Transcript {
  id: string;
  title: string;
  interviewDate: string | null;
  interviewee: string | null;
  sourceType: string;
  wordCount: number;
  tags: string[];
}

interface ListMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ListEnvelope {
  data: Transcript[];
  meta: ListMeta;
}

export default function ConsumerPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [offset, setOffset] = useState(0);
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [appliedTitle, setAppliedTitle] = useState('');
  const [appliedSourceType, setAppliedSourceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildUrl = useCallback(
    (t: string, s: string, o: number) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(o),
        sort: 'interviewDate',
        order: 'desc',
      });
      if (t) params.set('title', t);
      if (s) params.set('sourceType', s);
      return `${API_BASE}/api/v1/transcripts?${params.toString()}`;
    },
    []
  );

  const load = useCallback(
    async (t: string, s: string, o: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildUrl(t, s, o));
        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          const retryAfter = res.headers.get('Retry-After');
          try {
            const body = await res.json();
            if (body?.error?.message) message = body.error.message;
          } catch {
            /* non-JSON body */
          }
          if (res.status === 429) {
            message = `Rate limited — try again in ${retryAfter || 'a few'}s.`;
          }
          throw new Error(message);
        }
        const envelope = (await res.json()) as ListEnvelope;
        setTranscripts(envelope.data);
        setMeta(envelope.meta);
        setOffset(envelope.meta.offset);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load transcripts.');
        setTranscripts([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [buildUrl]
  );

  useEffect(() => {
    load('', '', 0);
  }, [load]);

  const applyFilters = () => {
    setAppliedTitle(title);
    setAppliedSourceType(sourceType);
    load(title, sourceType, 0);
  };

  const clearFilters = () => {
    setTitle('');
    setSourceType('');
    setAppliedTitle('');
    setAppliedSourceType('');
    load('', '', 0);
  };

  const prevPage = () => {
    if (offset > 0) load(appliedTitle, appliedSourceType, offset - PAGE_SIZE);
  };

  const nextPage = () => {
    if (meta?.hasMore) load(appliedTitle, appliedSourceType, offset + PAGE_SIZE);
  };

  const hasFilter = appliedTitle !== '' || appliedSourceType !== '';
  const filteredLabel =
    (appliedTitle ? `title “${appliedTitle}” ` : '') +
    (appliedSourceType ? `source ${appliedSourceType}` : '');
  const from = meta && meta.total > 0 ? meta.offset + 1 : 0;
  const to = meta && transcripts.length > 0 ? meta.offset + transcripts.length : 0;

  return (
    <main>
      <h1>Interview transcripts</h1>
      <p className="subtitle">
        Consuming the public API: <code>{API_BASE}/api/v1/transcripts</code>
      </p>

      {error && <p className="error">{error}</p>}

      <div className="controls">
        <div className="field">
          <label htmlFor="title">Title contains</label>
          <input
            id="title"
            value={title}
            placeholder="e.g. onboarding"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="sourceType">Source type</label>
          <select
            id="sourceType"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            <option value="">Any</option>
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button onClick={applyFilters} disabled={loading}>
          Apply filter
        </button>
        {hasFilter && (
          <button onClick={clearFilters} disabled={loading}>
            Clear
          </button>
        )}
      </div>

      <p className="meta">
        {meta
          ? hasFilter
            ? `${from}–${to} of ${meta.total} (filtered: ${filteredLabel})`
            : `${from}–${to} of ${meta.total}`
          : 'Loading…'}
      </p>

      <ul className="list">
        {transcripts.map((t) => (
          <li key={t.id}>
            <div className="title">{t.title}</div>
            <div className="sub">
              {t.interviewee ? `${t.interviewee} · ` : ''}
              {t.interviewDate
                ? new Date(t.interviewDate).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'no date'}
              {' · '}
              {t.wordCount.toLocaleString()} words · {t.sourceType}
            </div>
            {t.tags.length > 0 && (
              <div className="tags">
                {t.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
        {!loading && transcripts.length === 0 && !error && (
          <li className="empty">No transcripts match the current filter.</li>
        )}
      </ul>

      <div className="pager">
        <button onClick={prevPage} disabled={offset === 0 || loading}>
          Previous
        </button>
        <button onClick={nextPage} disabled={!meta?.hasMore || loading}>
          Next page
        </button>
        <span>
          Page {Math.floor(offset / PAGE_SIZE) + 1}
        </span>
      </div>
    </main>
  );
}
