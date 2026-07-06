import { createClient } from '@/lib/supabase/server';
import { DilemmaCard } from '@/components/dilemma-card';
import { pickNextDilemmaId, loadDilemmaCardData } from '@/lib/dilemma-data';

const PLACEHOLDER_DILEMMAS = [
  {
    body: 'My roommate ate my labeled leftovers again, so I changed the wifi password out of spite and told her it "reset itself."',
    category: 'ROOMMATES',
  },
  {
    body: "My best friend's boyfriend has been texting me late at night about their relationship problems. I haven't told her because I don't want to start drama.",
    category: 'DATING',
  },
  {
    body: 'My parents paid off my sister\'s student loans but not mine, so I stopped inviting them to things until they "even it out."',
    category: 'FAMILY',
  },
];

export default async function Home() {
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

  const { count: liveCount } = await supabase
    .from('dilemmas')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'live');

  if (!liveCount) {
    await supabase.from('dilemmas').insert(
      PLACEHOLDER_DILEMMAS.map((d) => ({
        author_id: user.id,
        body: d.body,
        category: d.category,
      }))
    );
  }

  const dilemmaId = await pickNextDilemmaId(supabase, user.id);

  if (!dilemmaId) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-center font-meta text-sm text-muted-2">
        No cases live right now. Check back soon.
      </div>
    );
  }

  const data = await loadDilemmaCardData(supabase, user.id, dilemmaId);
  if (!data) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-center font-meta text-sm text-muted-2">
        No cases live right now. Check back soon.
      </div>
    );
  }

  return <DilemmaCard {...data} />;
}
