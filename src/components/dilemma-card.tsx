'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { voteAndReveal, type VerdictRow } from '@/app/vote-actions';
import { timeAgo, initialsFromHandle } from '@/lib/format';
import { CommentsSheet } from '@/components/comments-sheet';
import { BreakdownSection } from '@/components/breakdown-section';

type Choice = 'a' | 'b';

type Verdict = {
  aPct: number;
  bPct: number;
  aCount: number;
  bCount: number;
  total: number;
};

// The dilemma body can run up to 600 chars (DB constraint), but each card is
// clipped to exactly one screen (see the overflow-hidden content wrapper
// below) — so long posts need a smaller starting size to have any real chance
// of fitting alongside the header, images, and vote row without being cut
// off. clamp() additionally scales with viewport width for narrower phones.
function dilemmaBodyFontSize(bodyLength: number): string {
  if (bodyLength <= 120) return 'clamp(19px, 5.6vw, 23px)';
  if (bodyLength <= 220) return 'clamp(17px, 5vw, 20px)';
  if (bodyLength <= 340) return 'clamp(15px, 4.4vw, 18px)';
  return 'clamp(14px, 4vw, 16px)';
}

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
  imageUrls,
  isOwnPost,
  initialChoice,
  initialVerdictRows,
  commentCount,
  isPremium,
  hasHandle,
  onNext,
  onSheetOpenChange,
}: {
  dilemmaId: string;
  body: string;
  category: string | null;
  labelA: string;
  labelB: string;
  authorHandle: string | null;
  createdAt: string;
  imageUrls: string[];
  isOwnPost: boolean;
  initialChoice: Choice | null;
  initialVerdictRows: VerdictRow[] | null;
  commentCount: number;
  isPremium: boolean;
  hasHandle: boolean;
  onNext?: () => void;
  onSheetOpenChange?: (open: boolean) => void;
}) {
  const [choice, setChoice] = useState<Choice | null>(initialChoice);
  const [verdict, setVerdict] = useState<Verdict | null>(
    initialVerdictRows ? toVerdict(initialVerdictRows) : null
  );
  const [pending, startTransition] = useTransition();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCountState, setCommentCountState] = useState(commentCount);

  // Notify a parent feed on the actual open/close transition so it can hide its
  // single shared FAB — done imperatively (not via effect) to avoid a render loop.
  function openComments() {
    setCommentsOpen(true);
    onSheetOpenChange?.(true);
  }
  function closeComments() {
    setCommentsOpen(false);
    onSheetOpenChange?.(false);
  }

  function handleVote(pick: Choice) {
    if (!canVote) return;
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
  // Results show once there's a verdict (after voting, or immediately for the
  // author of the case). The author never gets vote buttons — view-only.
  const showResults = !!verdict;
  const canVote = !isOwnPost && !choice && !verdict && !pending;

  const voteRow = (
    <div className="relative flex w-full gap-3">
      <button
        disabled={!canVote}
        onClick={() => handleVote('a')}
        className="vote-btn-spring flex-1 rounded-vote bg-plum px-6 py-6 text-left text-white disabled:cursor-default"
        style={{
          transform: verdict ? `scale(${aIsMajority ? 1.03 : 0.97})` : undefined,
          boxShadow: choice === 'a' ? '0 0 0 4px var(--color-ink)' : undefined,
        }}
      >
        <div className="font-display text-[24px]">{labelA}</div>
        {verdict && (
          <div className="animate-jelly mt-1 font-display text-[28px]">{verdict.aPct}%</div>
        )}
      </button>

      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] items-center justify-center rounded-full border-[3px] border-ink bg-cream font-display text-[16px] text-ink">
        VS
      </div>

      <button
        disabled={!canVote}
        onClick={() => handleVote('b')}
        className="vote-btn-spring flex-1 rounded-vote bg-teal px-6 py-6 text-left text-white disabled:cursor-default"
        style={{
          transform: verdict ? `scale(${!aIsMajority ? 1.03 : 0.97})` : undefined,
          boxShadow: choice === 'b' ? '0 0 0 4px var(--color-ink)' : undefined,
        }}
      >
        <div className="font-display text-[24px]">{labelB}</div>
        {verdict && (
          <div className="animate-jelly mt-1 font-display text-[28px]">{verdict.bPct}%</div>
        )}
      </button>
    </div>
  );

  return (
    // Root fills exactly one card slide (h-full of the section's own 100%-
    // viewport height) but stays overflow-visible and un-positioned — the
    // comments sheet below is a sibling here, not nested inside the clipped
    // wrapper, so its fixed/sm:absolute overlay is never clipped by it.
    <div className="h-full">
      {/* All visual card content lives here, clipped to exactly one screen —
          a long dilemma + images + vote row can never grow taller than the
          card and spill into the next reel underneath it. */}
      <div className="flex h-full flex-col overflow-hidden px-5 pb-8 pt-5">
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
              {/* timeAgo is computed from Date.now(), so it can legitimately
                  differ between server render and client hydration (e.g. the
                  clock ticks past a minute/hour boundary in between). */}
              <span suppressHydrationWarning>{timeAgo(createdAt)}</span> ·{' '}
              {(category ?? 'GENERAL').toUpperCase()}
            </div>
          </div>
        </div>

        {/* The dilemma — font size steps down for longer posts (see
            dilemmaBodyFontSize) so long text has a real chance of fitting
            inside one clipped screen alongside the header/images/vote row. */}
        <p
          className="mt-6 font-display leading-[1.12] tracking-[-0.01em] text-ink"
          style={{ textWrap: 'balance', fontSize: dilemmaBodyFontSize(body.length) }}
        >
          &ldquo;{body}&rdquo;
        </p>

        {/* Attached images. Sized via inline style, not height/width utility
            classes — those weren't reliably compiling in dev and let an
            unconstrained img blow out its intrinsic aspect ratio. */}
        {imageUrls.length === 1 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrls[0]}
            alt=""
            className="mt-4 w-full"
            style={{ maxHeight: 260, borderRadius: 20, objectFit: 'cover' }}
          />
        ) : imageUrls.length > 1 ? (
          <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto">
            {imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="flex-none"
                style={{ width: 128, height: 160, borderRadius: 16, objectFit: 'cover' }}
              />
            ))}
          </div>
        ) : null}

        {showResults ? (
          /* Results view (after voting, or the author's own case). Unchanged
             layout — compact, top-aligned so the breakdown fits below. */
          <>
            <div className="relative mt-6 flex items-center">{voteRow}</div>

            {verdict && verdict.total > 0 && (
              <div className="animate-fade-in mx-auto mt-4 rounded-pill bg-tan-chip-bg px-4 py-2 text-[13px] font-extrabold text-tan-chip-text">
                🎉 {verdict.total} have ruled
              </div>
            )}

            <button
              onClick={openComments}
              className="animate-fade-in mt-4 w-full rounded-[22px] bg-tan-chip-bg px-4 py-4 text-[15px] font-extrabold text-tan-chip-text"
            >
              💬 see the takes ({commentCountState})
            </button>

            <BreakdownSection
              dilemmaId={dilemmaId}
              labelA={labelA}
              labelB={labelB}
              initialIsPremium={isPremium}
            />
          </>
        ) : (
          /* Pre-vote: center the buttons in the open space so the screen feels
             full; the swipe hint stays pinned at the bottom. */
          <div className="flex flex-1 items-center py-6">{voteRow}</div>
        )}

        {onNext && (
          <button
            onClick={onNext}
            className={`w-full text-center font-meta text-[11px] tracking-[0.1em] text-muted-3 ${
              showResults ? 'mt-6' : 'mt-2'
            }`}
          >
            SWIPE UP FOR THE NEXT CASE ↑
          </button>
        )}
      </div>

      {commentsOpen && (
        <CommentsSheet
          dilemmaId={dilemmaId}
          labelA={labelA}
          labelB={labelB}
          initialHasHandle={hasHandle}
          onClose={closeComments}
          onPosted={() => setCommentCountState((n) => n + 1)}
        />
      )}
    </div>
  );
}
