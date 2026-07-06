'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { voteAndReveal, type VerdictRow } from '@/app/vote-actions';
import { timeAgo, initialsFromHandle } from '@/lib/format';
import { CommentsSheet } from '@/components/comments-sheet';
import { BreakdownSection } from '@/components/breakdown-section';
import { PostFab } from '@/components/post-fab';

type Choice = 'a' | 'b';

type Verdict = {
  aPct: number;
  bPct: number;
  aCount: number;
  bCount: number;
  total: number;
};

function toVerdict(rows: VerdictRow[]): Verdict {
  const aCount = Number(rows.find((r) => r.choice === 'a')?.cnt ?? 0);
  const bCount = Number(rows.find((r) => r.choice === 'b')?.cnt ?? 0);
  const total = aCount + bCount;
  const aPct = total ? Math.round((aCount / total) * 100) : 50;
  const bPct = total ? 100 - aPct : 50;
  return { aPct, bPct, aCount, bCount, total };
}

export function DilemmaCard({
  dilemmaId,
  body,
  category,
  labelA,
  labelB,
  authorHandle,
  createdAt,
  initialChoice,
  initialVerdictRows,
  commentCount,
  isPremium,
  hasHandle,
}: {
  dilemmaId: string;
  body: string;
  category: string | null;
  labelA: string;
  labelB: string;
  authorHandle: string | null;
  createdAt: string;
  initialChoice: Choice | null;
  initialVerdictRows: VerdictRow[] | null;
  commentCount: number;
  isPremium: boolean;
  hasHandle: boolean;
}) {
  const [choice, setChoice] = useState<Choice | null>(initialChoice);
  const [verdict, setVerdict] = useState<Verdict | null>(
    initialVerdictRows ? toVerdict(initialVerdictRows) : null
  );
  const [pending, startTransition] = useTransition();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCountState, setCommentCountState] = useState(commentCount);

  function handleVote(pick: Choice) {
    if (choice || pending) return;
    setChoice(pick);
    startTransition(async () => {
      const result = await voteAndReveal(dilemmaId, pick);
      if ('data' in result) {
        setVerdict(toVerdict(result.data));
      } else {
        console.error(result.error);
        setChoice(null);
      }
    });
  }

  const aIsMajority = verdict ? verdict.aPct >= verdict.bPct : false;

  return (
    <div className="flex min-h-full flex-col px-5 pb-8 pt-5">
      {/* App bar */}
      <div className="flex items-center gap-3">
        <div className="font-display text-[21px] text-ink">
          verdict<span className="text-plum">.</span>
        </div>
        <Link href="/search" aria-label="Search" className="text-[18px] text-muted-1">
          🔍
        </Link>
      </div>

      {/* Poster header */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-poster-avatar font-display text-[15px] text-white">
          {initialsFromHandle(authorHandle)}
        </div>
        <div>
          <div className="text-[14px] font-extrabold text-ink">
            @{authorHandle ?? 'anonymous'}{' '}
            <span className="font-semibold text-muted-3">· asked</span>
          </div>
          <div className="font-meta text-[11px] text-muted-3">
            {timeAgo(createdAt)} · {(category ?? 'GENERAL').toUpperCase()}
          </div>
        </div>
      </div>

      {/* The dilemma */}
      <p
        className="mt-6 font-display text-[27px] leading-[1.03] tracking-[-0.02em] text-ink"
        style={{ textWrap: 'balance' }}
      >
        &ldquo;{body}&rdquo;
      </p>

      {/* Vote area */}
      <div className="relative flex flex-1 items-center">
        <div className="relative flex w-full gap-3">
          <button
            disabled={!!choice || pending}
            onClick={() => handleVote('a')}
            className="vote-btn-spring flex-1 rounded-vote bg-plum px-6 py-6 text-left text-white disabled:cursor-default"
            style={{
              transform: verdict ? `scale(${aIsMajority ? 1.03 : 0.97})` : undefined,
              boxShadow: choice === 'a' ? '0 0 0 4px var(--color-ink)' : undefined,
            }}
          >
            <div className="font-display text-[24px]">{labelA}</div>
            {verdict && (
              <div className="animate-jelly mt-1 font-display text-[28px]">
                {verdict.aPct}%
              </div>
            )}
          </button>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] items-center justify-center rounded-full border-[3px] border-ink bg-cream font-display text-[16px] text-ink">
            VS
          </div>

          <button
            disabled={!!choice || pending}
            onClick={() => handleVote('b')}
            className="vote-btn-spring flex-1 rounded-vote bg-teal px-6 py-6 text-left text-white disabled:cursor-default"
            style={{
              transform: verdict ? `scale(${!aIsMajority ? 1.03 : 0.97})` : undefined,
              boxShadow: choice === 'b' ? '0 0 0 4px var(--color-ink)' : undefined,
            }}
          >
            <div className="font-display text-[24px]">{labelB}</div>
            {verdict && (
              <div className="animate-jelly mt-1 font-display text-[28px]">
                {verdict.bPct}%
              </div>
            )}
          </button>
        </div>
      </div>

      {verdict && (
        <div className="animate-fade-in mx-auto mt-4 rounded-pill bg-tan-chip-bg px-4 py-2 text-[13px] font-extrabold text-tan-chip-text">
          🎉 {verdict.total} have ruled
        </div>
      )}

      {verdict && (
        <button
          onClick={() => setCommentsOpen(true)}
          className="animate-fade-in mt-4 w-full rounded-[22px] bg-tan-chip-bg px-4 py-4 text-[15px] font-extrabold text-tan-chip-text"
        >
          💬 see the takes ({commentCountState})
        </button>
      )}

      {verdict && (
        <BreakdownSection
          dilemmaId={dilemmaId}
          labelA={labelA}
          labelB={labelB}
          initialIsPremium={isPremium}
        />
      )}

      <div className="mt-6 text-center font-meta text-[11px] tracking-[0.1em] text-muted-3">
        SWIPE FOR THE NEXT CASE →
      </div>

      {commentsOpen && (
        <CommentsSheet
          dilemmaId={dilemmaId}
          labelA={labelA}
          labelB={labelB}
          initialHasHandle={hasHandle}
          onClose={() => setCommentsOpen(false)}
          onPosted={() => setCommentCountState((n) => n + 1)}
        />
      )}

      <PostFab hidden={commentsOpen} />
    </div>
  );
}
