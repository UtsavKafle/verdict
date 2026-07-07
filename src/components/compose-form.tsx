'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createDilemma } from '@/app/post-actions';
import { unlockPremium } from '@/app/premium-actions';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/categories';
import { LABEL_PRESETS } from '@/lib/label-presets';
import { ClaimHandleSheet } from '@/components/claim-handle-sheet';

const MAX_IMAGES = 5;

type ImagePick = { file: File; url: string };

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
  const [presetIndex, setPresetIndex] = useState(0);
  const [targetGender, setTargetGender] = useState<string | null>(null);
  const [targetAgeBand, setTargetAgeBand] = useState<string | null>(null);
  const [images, setImages] = useState<ImagePick[]>([]);
  const [isPremium, setIsPremium] = useState(initialIsPremium);
  const [hasHandle, setHasHandle] = useState(initialHasHandle);
  const [showClaim, setShowClaim] = useState(false);
  const [posting, startPosting] = useTransition();
  const [unlocking, startUnlocking] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEveryone = !targetGender && !targetAgeBand;
  const canSubmit = body.trim().length >= 10 && body.trim().length <= 600 && category && !posting;

  function handleFilesPicked(list: FileList | null) {
    if (!list) return;
    const room = MAX_IMAGES - images.length;
    const picks = Array.from(list)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...picks]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  // Upload the picked images to Storage and return their public URLs.
  async function uploadImages(): Promise<string[]> {
    if (images.length === 0) return [];
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('no_session');

    const urls: string[] = [];
    for (const { file } of images) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('dilemma-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      urls.push(supabase.storage.from('dilemma-images').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

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
      try {
        const imageUrls = await uploadImages();
        const result = await createDilemma({
          body,
          category: category!,
          targetGender,
          targetAgeBand,
          imageUrls,
          labelA: LABEL_PRESETS[presetIndex].a,
          labelB: LABEL_PRESETS[presetIndex].b,
        });
        if ('data' in result) {
          router.push(`/d/${result.data.id}`);
        } else {
          setError(result.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'upload_failed');
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

        {/* Images (up to 5) */}
        <div className="mt-4 flex items-center justify-between">
          <div className="font-display text-[16px] text-ink">
            photos <span className="font-meta text-[11px] text-muted-3">optional</span>
          </div>
          <div className="font-meta text-[11px] text-muted-3">{images.length}/{MAX_IMAGES}</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesPicked(e.target.files)}
        />
        {/* Fixed pixel sizes via inline style, not h-20/w-20 utility classes —
            Tailwind's numeric scale utilities weren't reliably compiling in
            dev here, and a stray unconstrained <img> blows out this row's
            height and pushes category/jury/post-it off screen. */}
        <div className="scrollbar-hide mt-2 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <div key={img.url} className="relative flex-none" style={{ width: 80, height: 80 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label="Remove image"
                className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white"
                style={{ width: 24, height: 24 }}
              >
                ×
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-none items-center justify-center rounded-[14px] bg-tan-chip-bg text-[24px] text-tan-chip-text"
              style={{ width: 80, height: 80 }}
            >
              +
            </button>
          )}
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

        {/* Vote label preset — side A stays plum/left, side B teal/right. */}
        <div className="mt-4 font-display text-[16px] text-ink">the two sides</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {LABEL_PRESETS.map((preset, i) => (
            <button
              key={preset.a}
              type="button"
              onClick={() => setPresetIndex(i)}
              className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-bold ${
                presetIndex === i ? 'bg-ink text-white' : 'bg-tan-chip-bg text-tan-chip-text'
              }`}
            >
              <span>{preset.a}</span>
              <span className="opacity-40">/</span>
              <span>{preset.b}</span>
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
