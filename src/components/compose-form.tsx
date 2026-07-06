'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDilemma } from '@/app/post-actions';
import { unlockPremium } from '@/app/premium-actions';
import { CATEGORIES } from '@/lib/categories';
import { ClaimHandleSheet } from '@/components/claim-handle-sheet';

const JURY_OPTIONS: { label: string; gender: string | null; ageBand: string | null }[] = [
  { label: 'women', gender: 'female', ageBand: null },
  { label: 'men', gender: 'male', ageBand: null },
  { label: '18–21', gender: null, ageBand: '18-21' },
  { label: '22–25', gender: null, ageBand: '22-25' },
];

export function ComposeForm({
  initialIsPremium,
  initialHasHandle,
}: {
  initialIsPremium: boolean;
  initialHasHandle: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [targetGender, setTargetGender] = useState<string | null>(null);
  const [targetAgeBand, setTargetAgeBand] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [hasHandle, setHasHandle] = useState(initialHasHandle);
  const [showClaim, setShowClaim] = useState(false);
  const [posting, startPosting] = useTransition();
  const [unlocking, startUnlocking] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEveryone = !targetGender && !targetAgeBand;
  const canSubmit = body.trim().length >= 10 && body.trim().length <= 600 && category && !posting;

  function selectEveryone() {
    setTargetGender(null);
    setTargetAgeBand(null);
  }

  function handleJuryTap(gender: string | null, ageBand: string | null) {
    if (!isPremium) {
      startUnlocking(async () => {
        const result = await unlockPremium('targeting');
        if ('data' in result) {
          setIsPremium(true);
          setTargetGender(gender);
          setTargetAgeBand(ageBand);
        }
      });
      return;
    }
    setTargetGender(gender);
    setTargetAgeBand(ageBand);
  }

  function doPost() {
    startPosting(async () => {
      const result = await createDilemma({ body, category: category!, targetGender, targetAgeBand });
      if ('data' in result) {
        router.push(`/d/${result.data.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !category) return;
    setError(null);
    // First post by an anonymous visitor claims a handle before it goes live.
    if (!hasHandle) {
      setShowClaim(true);
      return;
    }
    doPost();
  }

  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-5">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Back" className="text-[20px] text-ink">
          ←
        </Link>
        <div className="font-display text-[21px] text-ink">new case</div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-1 flex-col">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={600}
          rows={6}
          placeholder="what happened? give the jury the details…"
          className="w-full rounded-[22px] bg-white px-4 py-3 text-[15px] leading-[1.4] text-body-ink outline-none"
        />
        <div className="mt-1 text-right font-meta text-[11px] text-muted-3">
          {body.trim().length}/600
        </div>

        <div className="mt-4 font-display text-[16px] text-ink">category</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-pill px-3 py-1.5 text-[12px] font-bold ${
                category === c ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
              }`}
            >
              {c.toLowerCase()}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 font-display text-[16px] text-ink">
            who&apos;s your jury? <span>🔒</span>
          </div>
          <div className="mt-1 font-meta text-[11px] text-muted-3">
            everyone votes — this just picks whose verdict you&apos;ll see
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectEveryone}
              className={`rounded-pill px-3 py-1.5 text-[12px] font-bold ${
                isEveryone ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
              }`}
            >
              everyone
            </button>
            {JURY_OPTIONS.map((opt) => {
              const selected =
                !isEveryone && targetGender === opt.gender && targetAgeBand === opt.ageBand;
              return (
                <button
                  key={opt.label}
                  type="button"
                  disabled={unlocking}
                  onClick={() => handleJuryTap(opt.gender, opt.ageBand)}
                  className={`rounded-pill px-3 py-1.5 text-[12px] font-bold disabled:opacity-60 ${
                    selected ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
                  }`}
                >
                  {!isPremium && '🔒 '}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <div className="mt-3 font-meta text-[12px] text-plum">{error}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-auto w-full rounded-[22px] bg-plum px-4 py-4 text-[15px] font-extrabold text-white disabled:opacity-50"
        >
          {posting ? 'posting…' : 'post it'}
        </button>
      </form>

      {showClaim && (
        <ClaimHandleSheet
          onClose={() => setShowClaim(false)}
          onClaimed={() => {
            setHasHandle(true);
            setShowClaim(false);
            doPost();
          }}
        />
      )}
    </div>
  );
}
