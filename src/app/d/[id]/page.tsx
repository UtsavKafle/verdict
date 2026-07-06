import { createClient } from '@/lib/supabase/server';
import { DilemmaCard } from '@/components/dilemma-card';
import { loadDilemmaCardData } from '@/lib/dilemma-data';

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

  const data = await loadDilemmaCardData(supabase, user.id, id);

  if (!data) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-center font-meta text-sm text-muted-2">
        Case not found.
      </div>
    );
  }

  return <DilemmaCard {...data} />;
}
