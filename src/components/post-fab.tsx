import Link from 'next/link';

export function PostFab({ hidden }: { hidden?: boolean }) {
  if (hidden) return null;

  return (
    <Link
      href="/post"
      aria-label="Post a dilemma"
      className="fixed sm:absolute z-30 flex h-[58px] w-[58px] items-center justify-center rounded-full border-[3px] border-cream bg-plum font-display text-[30px] text-white shadow-[0_8px_22px_rgba(26,24,21,0.28)]"
      style={{
        right: 'max(18px, env(safe-area-inset-right))',
        bottom: 'max(18px, env(safe-area-inset-bottom))',
      }}
    >
      +
    </Link>
  );
}
