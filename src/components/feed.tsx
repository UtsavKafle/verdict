'use client';

import { useEffect, useRef, useState } from 'react';
import { DilemmaCard } from '@/components/dilemma-card';
import { PostFab } from '@/components/post-fab';
import type { DilemmaCardData } from '@/lib/dilemma-data';

const SCROLL_KEY = 'verdict:feed-index';

// `persist` controls the home-feed scroll-restore. The /d/[id] feed opens on a
// specific case, so it starts at the top and skips localStorage entirely.
export function Feed({ items, persist = true }: { items: DilemmaCardData[]; persist?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const [openSheets, setOpenSheets] = useState(0);

  // Home feed restores the last-viewed case; the /d/[id] feed (persist=false)
  // always opens on the first card — override the browser/router trying to keep
  // a scroll position carried over from the previous page (e.g. after posting).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!persist) {
      el.scrollTo({ top: 0 });
      return;
    }
    const saved = Number(localStorage.getItem(SCROLL_KEY) ?? '0');
    if (saved > 0 && saved < items.length) {
      el.scrollTo({ top: saved * el.clientHeight });
    }
  }, [items.length, persist]);

  // Persist the snapped case index as the user scrolls.
  useEffect(() => {
    if (!persist) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollTop / el.clientHeight);
        localStorage.setItem(SCROLL_KEY, String(idx));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [persist]);

  function goToNext(i: number) {
    sectionRefs.current[i + 1]?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="scrollbar-hide h-full snap-y snap-mandatory overflow-y-scroll"
      >
        {items.map((item, i) => (
          <section
            key={item.dilemmaId}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            className="flex min-h-full flex-col snap-start"
          >
            <DilemmaCard
              {...item}
              onNext={i < items.length - 1 ? () => goToNext(i) : undefined}
              onSheetOpenChange={(open) => setOpenSheets((n) => n + (open ? 1 : -1))}
            />
          </section>
        ))}
      </div>
      <PostFab hidden={openSheets > 0} />
    </>
  );
}
