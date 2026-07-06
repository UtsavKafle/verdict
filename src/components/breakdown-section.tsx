'use client';

import { useEffect, useState, useTransition } from 'react';
import { unlockPremium, getVerdictBreakdown, type BreakdownRow } from '@/app/premium-actions';

function segmentLabel(segment: string): string {
  if (segment === 'female') return 'women';
  if (segment === 'male') return 'men';
  return segment;
}

function Bar({
  row,
  labelA,
  labelB,
}: {
  row: BreakdownRow;
  labelA: string;
  labelB: string;
}) {
  const total = row.a_count + row.b_count;
  const aPct = total ? Math.round((row.a_count / total) * 100) : 50;
  const bPct = 100 - aPct;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px] font-extrabold text-ink">
        <span>{segmentLabel(row.segment)}</span>
        <span className="font-normal text-muted-2">{total} rulings</span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-pill">
        <div className="flex items-center bg-plum pl-2 text-[10px] font-bold text-white" style={{ width: `${aPct}%` }}>
          {aPct >= 15 ? `${labelA} ${aPct}%` : ''}
        </div>
        <div className="flex items-center justify-end bg-teal pr-2 text-[10px] font-bold text-white" style={{ width: `${bPct}%` }}>
          {bPct >= 15 ? `${labelB} ${bPct}%` : ''}
        </div>
      </div>
    </div>
  );
}

export function BreakdownSection({
  dilemmaId,
  labelA,
  labelB,
  initialIsPremium,
}: {
  dilemmaId: string;
  labelA: string;
  labelB: string;
  initialIsPremium: boolean;
}) {
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [dimension, setDimension] = useState<'gender' | 'age'>('gender');
  const [rows, setRows] = useState<BreakdownRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, startUnlocking] = useTransition();

  useEffect(() => {
    if (!isPremium) return;
    let cancelled = false;
    setLoading(true);
    getVerdictBreakdown(dilemmaId, dimension).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if ('data' in res) setRows(res.data);
      else {
        console.error(res.error);
        setRows([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isPremium, dimension, dilemmaId]);

  function handleUnlock() {
    startUnlocking(async () => {
      const result = await unlockPremium('breakdown', dilemmaId);
      if ('data' in result) setIsPremium(true);
      else console.error(result.error);
    });
  }

  return (
    <div className="mt-6 border-t border-sheet-border pt-5">
      <div className="flex items-center gap-2 font-display text-[17px] text-ink">
        how each group ruled <span>🔒</span>
      </div>

      {!isPremium && (
        <button
          onClick={handleUnlock}
          disabled={unlocking}
          className="mt-3 w-full rounded-[22px] bg-plum px-4 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
        >
          unlock the breakdown →
        </button>
      )}

      {isPremium && (
        <div className="mt-3">
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setDimension('gender')}
              className={`rounded-pill px-3 py-1 text-[12px] font-bold ${
                dimension === 'gender' ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
              }`}
            >
              by gender
            </button>
            <button
              onClick={() => setDimension('age')}
              className={`rounded-pill px-3 py-1 text-[12px] font-bold ${
                dimension === 'age' ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
              }`}
            >
              by age
            </button>
          </div>

          {loading && <div className="font-meta text-[12px] text-muted-2">Loading…</div>}
          {!loading && rows?.length === 0 && (
            <div className="font-meta text-[12px] text-muted-2">not enough rulings yet</div>
          )}
          {!loading && rows && rows.length > 0 && (
            <div className="space-y-3">
              {rows.map((row) => (
                <Bar key={row.segment} row={row} labelA={labelA} labelB={labelB} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
