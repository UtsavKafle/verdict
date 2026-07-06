'use client';

import { useEffect, useState, useTransition } from 'react';
import { claimHandle } from '@/app/profile-actions';

const AGE_BANDS = ['18-21', '22-25', '26+'];
const GENDERS: { label: string; value: string }[] = [
  { label: 'woman', value: 'female' },
  { label: 'man', value: 'male' },
  { label: 'nonbinary', value: 'nonbinary' },
];

export function ClaimHandleSheet({
  onClaimed,
  onClose,
}: {
  onClaimed: (handle: string) => void;
  onClose: () => void;
}) {
  const [handle, setHandle] = useState('');
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    const shell = document.getElementById('app-shell');
    const prevOverflow = shell?.style.overflow;
    if (shell) shell.style.overflow = 'hidden';
    return () => {
      if (shell) shell.style.overflow = prevOverflow ?? '';
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = handle.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(h)) {
      setError('3–20 letters, numbers, or _');
      return;
    }
    setError(null);
    startSaving(async () => {
      const res = await claimHandle({ handle: h, ageBand, gender });
      if ('data' in res) {
        onClaimed(res.data.handle);
      } else if (res.error === 'handle_taken') {
        setError("that handle's taken — try another");
      } else if (res.error === 'invalid_handle') {
        setError('3–20 letters, numbers, or _');
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <div
        className="animate-fade-in fixed sm:absolute inset-0 z-[60] bg-ink/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="animate-sheet-up fixed sm:absolute inset-x-0 bottom-0 z-[70] flex max-h-[85%] flex-col rounded-t-[32px] bg-cream shadow-[0_-20px_40px_rgba(0,0,0,0.15)]">
        <div className="flex justify-center pt-3">
          <div className="h-[5px] w-11 rounded-full bg-sheet-grabber" />
        </div>

        <form onSubmit={submit} className="scrollbar-hide overflow-y-auto px-5 pb-6 pt-2">
          <div className="font-display text-[21px] text-ink">claim your handle 👋</div>
          <div className="mt-1 font-meta text-[11px] text-muted-3">
            pick a name the jury will know you by — you keep your votes and takes
          </div>

          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={20}
            autoFocus
            placeholder="pick a handle"
            className="mt-4 w-full rounded-[22px] bg-white px-4 py-3 text-[15px] text-body-ink outline-none"
          />

          <div className="mt-5 font-display text-[15px] text-ink">
            age <span className="font-body text-[12px] font-normal text-muted-3">· optional</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGE_BANDS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAgeBand(ageBand === a ? null : a)}
                className={`rounded-pill px-3 py-1.5 text-[12px] font-bold ${
                  ageBand === a ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="mt-5 font-display text-[15px] text-ink">
            gender{' '}
            <span className="font-body text-[12px] font-normal text-muted-3">· optional</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(gender === g.value ? null : g.value)}
                className={`rounded-pill px-3 py-1.5 text-[12px] font-bold ${
                  gender === g.value ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {error && <div className="mt-3 font-meta text-[12px] text-plum">{error}</div>}

          <button
            type="submit"
            disabled={!handle.trim() || saving}
            className="mt-6 w-full rounded-[22px] bg-plum px-4 py-4 text-[15px] font-extrabold text-white disabled:opacity-50"
          >
            {saving ? 'claiming…' : 'claim it'}
          </button>
        </form>
      </div>
    </>
  );
}
