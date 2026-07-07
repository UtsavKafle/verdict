import { createClient } from '@/lib/supabase/server';
import { Feed } from '@/components/feed';
import { loadFeedFromDilemma } from '@/lib/dilemma-data';

export default async function DilemmaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 font-meta text-sm text-muted-2">
        Signing you in…
      </div>
    );
  }

  const items = await loadFeedFromDilemma(supabase, user.id, id);

  if (items.length === 0) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-center font-meta text-sm text-muted-2">
        Case not found.
      </div>
    );
  }

  // Opens on the requested case, then continues into the rest of the feed so
  // there's no dead end (e.g. right after posting your own case).
  return <Feed items={items} persist={false} />;
}
