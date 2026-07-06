'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getComments,
  postComment,
  upvoteComment,
  type CommentRow,
} from '@/app/comment-actions';
import { timeAgo, initialsFromHandle } from '@/lib/format';
import { ClaimHandleSheet } from '@/components/claim-handle-sheet';

function pinMineFirst(list: CommentRow[], userId: string): CommentRow[] {
  const mine = list.filter((c) => c.authorId === userId);
  const others = list.filter((c) => c.authorId !== userId);
  return [...mine, ...others];
}

export function CommentsSheet({
  dilemmaId,
  labelA,
  labelB,
  initialHasHandle,
  onClose,
  onPosted,
}: {
  dilemmaId: string;
  labelA: string;
  labelB: string;
  initialHasHandle: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [posting, startPosting] = useTransition();
  const [hasHandle, setHasHandle] = useState(initialHasHandle);
  const [showClaim, setShowClaim] = useState(false);

  useEffect(() => {
    const shell = document.getElementById('app-shell');
    const prevOverflow = shell?.style.overflow;
    if (shell) shell.style.overflow = 'hidden';
    return () => {
      if (shell) shell.style.overflow = prevOverflow ?? '';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getComments(dilemmaId).then((res) => {
      if (cancelled) return;
      if ('data' in res) {
        setComments(pinMineFirst(res.data, res.userId));
        setUpvoted(new Set(res.myUpvotes));
        setUserId(res.userId);
      } else {
        setComments([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dilemmaId]);

  function handleUpvote(id: string) {
    if (upvoted.has(id)) return;
    setUpvoted((prev) => new Set(prev).add(id));
    setComments(
      (prev) => prev?.map((c) => (c.id === id ? { ...c, upvotes: c.upvotes + 1 } : c)) ?? prev
    );
    upvoteComment(id);
  }

  function postCommentBody(body: string) {
    startPosting(async () => {
      const result = await postComment(dilemmaId, body);
      if ('data' in result) {
        setComments((prev) => [result.data, ...(prev ?? [])]);
        onPosted();
      } else {
        console.error(result.error);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || posting) return;
    // First comment by an anonymous visitor claims a handle first.
    if (!hasHandle) {
      setShowClaim(true);
      return;
    }
    setText('');
    postCommentBody(body);
  }

  return (
    <>
      <div
        className="animate-fade-in fixed sm:absolute inset-0 z-40 bg-ink/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-sheet-up fixed sm:absolute inset-x-0 bottom-0 z-50 flex h-[70%] flex-col rounded-t-[32px] bg-cream shadow-[0_-20px_40px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-3">
          <div className="h-[5px] w-11 rounded-full bg-sheet-grabber" />
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <div className="font-display text-[21px] text-ink">the takes 💬</div>
          <button onClick={onClose} className="text-xl text-muted-2" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="scrollbar-hide flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          {comments === null && (
            <div className="py-8 text-center font-meta text-sm text-muted-2">Loading…</div>
          )}
          {comments?.length === 0 && (
            <div className="py-8 text-center font-meta text-sm text-muted-2">
              No takes yet — be the first.
            </div>
          )}
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-poster-avatar font-display text-[14px] text-white">
                {initialsFromHandle(c.handle)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-extrabold text-ink">
                    @{c.handle ?? 'anonymous'}
                  </span>
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[11px] font-bold text-white ${
                      c.choice === 'a' ? 'bg-comment-nta' : 'bg-comment-yta'
                    }`}
                  >
                    {c.choice === 'a' ? labelA : labelB}
                  </span>
                  <span className="text-[11px] text-muted-3">{timeAgo(c.createdAt)}</span>
                  {c.authorId === userId && (
                    <span className="text-[11px] text-muted-3">· you</span>
                  )}
                </div>
                <p className="mt-1 text-[15px] leading-[1.4] text-body-ink">{c.body}</p>
                <div className="mt-1 flex items-center gap-4">
                  <button
                    onClick={() => handleUpvote(c.id)}
                    disabled={upvoted.has(c.id)}
                    className={`text-[14px] font-bold ${
                      upvoted.has(c.id) ? 'text-ink' : 'text-muted-2'
                    }`}
                  >
                    ▲ {c.upvotes}
                  </button>
                  <button className="text-[14px] font-bold text-muted-2">reply</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-sheet-border px-4 py-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
            placeholder="add your take…"
            className="flex-1 rounded-[22px] bg-white px-4 py-3 text-[14px] text-body-ink outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || posting}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-plum text-white disabled:opacity-50"
          >
            ↑
          </button>
        </form>
      </div>

      {showClaim && (
        <ClaimHandleSheet
          onClose={() => setShowClaim(false)}
          onClaimed={() => {
            setHasHandle(true);
            setShowClaim(false);
            const body = text.trim();
            if (body) {
              setText('');
              postCommentBody(body);
            }
          }}
        />
      )}
    </>
  );
}
