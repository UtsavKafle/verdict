import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerdictRow } from '@/app/vote-actions';

export type DilemmaCardData = {
  dilemmaId: string;
  body: string;
  category: string | null;
  labelA: string;
  labelB: string;
  authorHandle: string | null;
  createdAt: string;
  initialChoice: 'a' | 'b' | null;
  initialVerdictRows: VerdictRow[] | null;
  commentCount: number;
  isPremium: boolean;
  hasHandle: boolean;
};

/** Earliest live dilemma this user hasn't voted on yet; falls back to the earliest live one if they've voted on everything. */
export async function pickNextDilemmaId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: myVotes } = await supabase
    .from('votes')
    .select('dilemma_id')
    .eq('voter_id', userId);
  const votedIds = (myVotes ?? []).map((v) => v.dilemma_id);

  let query = supabase
    .from('dilemmas')
    .select('id')
    .eq('status', 'live')
    .order('created_at', { ascending: true })
    .limit(1);
  if (votedIds.length) {
    query = query.not('id', 'in', `(${votedIds.join(',')})`);
  }
  const { data } = await query;
  if (data?.[0]) return data[0].id;

  const { data: fallback } = await supabase
    .from('dilemmas')
    .select('id')
    .eq('status', 'live')
    .order('created_at', { ascending: true })
    .limit(1);
  return fallback?.[0]?.id ?? null;
}

/** Full data needed to render <DilemmaCard> for a specific, already-known dilemma id. */
export async function loadDilemmaCardData(
  supabase: SupabaseClient,
  userId: string,
  dilemmaId: string
): Promise<DilemmaCardData | null> {
  const { data: dilemma } = await supabase
    .from('dilemmas')
    .select('id, body, category, label_a, label_b, author_id, created_at')
    .eq('id', dilemmaId)
    .maybeSingle();

  if (!dilemma) return null;

  const [{ data: authorProfile }, { data: myVoteRow }, { count: commentCount }, { data: myProfile }] =
    await Promise.all([
      supabase.from('profiles').select('handle').eq('id', dilemma.author_id).maybeSingle(),
      supabase
        .from('votes')
        .select('choice')
        .eq('dilemma_id', dilemma.id)
        .eq('voter_id', userId)
        .maybeSingle(),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('dilemma_id', dilemma.id),
      supabase.from('profiles').select('is_premium, handle').eq('id', userId).maybeSingle(),
    ]);

  let initialVerdictRows: VerdictRow[] | null = null;
  if (myVoteRow) {
    const { data } = await supabase.rpc('get_verdict', { p_dilemma_id: dilemma.id });
    initialVerdictRows = data;
  }

  return {
    dilemmaId: dilemma.id,
    body: dilemma.body,
    category: dilemma.category,
    labelA: dilemma.label_a,
    labelB: dilemma.label_b,
    authorHandle: authorProfile?.handle ?? null,
    createdAt: dilemma.created_at,
    initialChoice: (myVoteRow?.choice as 'a' | 'b' | undefined) ?? null,
    initialVerdictRows,
    commentCount: commentCount ?? 0,
    isPremium: myProfile?.is_premium ?? false,
    hasHandle: !!myProfile?.handle,
  };
}
