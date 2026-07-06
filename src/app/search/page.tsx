'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { searchDilemmas, type SearchResult } from '@/app/search-actions';
import { CATEGORIES } from '@/lib/categories';
import { PostFab } from '@/components/post-fab';

function snippet(body: string, len = 90): string {
  return body.length > len ? body.slice(0, len).trimEnd() + '…' : body;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      searchDilemmas(query, category).then((res) => {
        if (cancelled) return;
        if ('data' in res) setResults(res.data);
        else setResults([]);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, category]);

  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Back" className="text-[20px] text-ink">
          ←
        </Link>
        <div className="font-display text-[21px] text-ink">search the drama</div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search the drama…"
        className="mt-4 w-full rounded-[22px] bg-white px-4 py-3 text-[14px] text-body-ink outline-none"
      />

      <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
        <button
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-pill px-3 py-1.5 text-[12px] font-bold ${
            category === null ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
          }`}
        >
          all
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? null : c)}
            className={`shrink-0 rounded-pill px-3 py-1.5 text-[12px] font-bold ${
              category === c ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
            }`}
          >
            {c.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="scrollbar-hide mt-4 flex-1 space-y-3 overflow-y-auto">
        {results === null && (
          <div className="py-8 text-center font-meta text-sm text-muted-2">Loading…</div>
        )}
        {results?.length === 0 && (
          <div className="py-8 text-center font-meta text-sm text-muted-2">
            no cases match — try another search
          </div>
        )}
        {results?.map((r) => (
          <Link
            key={r.id}
            href={`/d/${r.id}`}
            className="block rounded-[18px] bg-tan-chip-bg/40 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-extrabold text-ink">
                @{r.authorHandle ?? 'anonymous'}
              </span>
              <span className="font-meta text-[10px] text-muted-3">
                {(r.category ?? 'GENERAL').toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-[14px] leading-[1.4] text-body-ink">{snippet(r.body)}</p>
            <div className="mt-1 font-meta text-[11px] text-muted-3">{r.voteCount} votes</div>
          </Link>
        ))}
      </div>

      <PostFab />
    </div>
  );
}
