import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerdictRow } from '@/app/vote-actions';

type DilemmaRow = {
  id: string;
  body: string;
  category: string | null;
  label_a: string;
  label_b: string;
  author_id: string;
  created_at: string;
  image_urls: string[] | null;
};

async function fetchDilemmaRow(
  supabase: SupabaseClient,
  dilemmaId: string
): Promise<DilemmaRow | null> {
  const { data } = await supabase
    .from('dilemmas')
    .select('id, body, category, label_a, label_b, author_id, created_at, image_urls')
    .eq('id', dilemmaId)
    .maybeSingle();
  return data as DilemmaRow | null;
}

export type DilemmaCardData = {
  dilemmaId: string;
  body: string;
  category: string | null;
  labelA: string;
  labelB: string;
  authorHandle: string | null;
  createdAt: string;
  imageUrls: string[];
  isOwnPost: boolean;
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

type MyProfile = { is_premium: boolean; handle: string | null };

/** Full data needed to render <DilemmaCard> for a specific, already-known dilemma id.
 *  Pass `myProfile` to skip re-fetching the caller's own profile (the feed loads it once). */
export async function loadDilemmaCardData(
  supabase: SupabaseClient,
  userId: string,
  dilemmaId: string,
  myProfile?: MyProfile
): Promise<DilemmaCardData | null> {
  const dilemma = await fetchDilemmaRow(supabase, dilemmaId);

  if (!dilemma) return null;

  const isOwnPost = dilemma.author_id === userId;

  const profilePromise = myProfile
    ? Promise.resolve({ data: myProfile })
    : supabase.from('profiles').select('is_premium, handle').eq('id', userId).maybeSingle();

  const [{ data: authorProfile }, { data: myVoteRow }, { count: commentCount }, { data: resolvedProfile }] =
    await Promise.all([
      supabase.from('profiles').select('handle').eq('id', dilemma.author_id).maybeSingle(),
      supabase
        .from('votes')
        .select('choice')
        .eq('dilemma_id', dilemma.id)
        .eq('voter_id', userId)
        .maybeSingle(),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('dilemma_id', dilemma.id),
      profilePromise,
    ]);

  // Voters see results after voting; the author sees them straight away
  // (they can't vote on their own case — get_verdict allows the author through).
  let initialVerdictRows: VerdictRow[] | null = null;
  if (myVoteRow || isOwnPost) {
    const { data } = await supabase.rpc('get_verdict', { p_dilemma_id: dilemma.id });
    initialVerdictRows = data ?? [];
  }

  return {
    dilemmaId: dilemma.id,
    body: dilemma.body,
    category: dilemma.category,
    labelA: dilemma.label_a,
    labelB: dilemma.label_b,
    authorHandle: authorProfile?.handle ?? null,
    createdAt: dilemma.created_at,
    imageUrls: (dilemma.image_urls as string[] | null) ?? [],
    isOwnPost,
    initialChoice: (myVoteRow?.choice as 'a' | 'b' | undefined) ?? null,
    initialVerdictRows,
    commentCount: commentCount ?? 0,
    isPremium: (resolvedProfile as MyProfile | null)?.is_premium ?? false,
    hasHandle: !!(resolvedProfile as MyProfile | null)?.handle,
  };
}

/** Vertical feed: the caller's unvoted live cases (newest first), falling back to
 *  all live cases once they've ruled on everything so the feed is never empty. */
export async function loadFeedDilemmas(
  supabase: SupabaseClient,
  userId: string,
  limit = 12
): Promise<DilemmaCardData[]> {
  const [{ data: myVotes }, { data: myProfile }] = await Promise.all([
    supabase.from('votes').select('dilemma_id').eq('voter_id', userId),
    supabase.from('profiles').select('is_premium, handle').eq('id', userId).maybeSingle(),
  ]);
  const votedIds = (myVotes ?? []).map((v) => v.dilemma_id);

  let query = supabase
    .from('dilemmas')
    .select('id')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (votedIds.length) {
    query = query.not('id', 'in', `(${votedIds.join(',')})`);
  }
  let { data: rows } = await query;
  let ids = (rows ?? []).map((r) => r.id);

  if (ids.length === 0) {
    const { data: fallback } = await supabase
      .from('dilemmas')
      .select('id')
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(limit);
    ids = (fallback ?? []).map((r) => r.id);
  }

  const cards = await Promise.all(
    ids.map((id) => loadDilemmaCardData(supabase, userId, id, myProfile ?? undefined))
  );
  return cards.filter((c): c is DilemmaCardData => c !== null);
}

/** Feed for /d/[id]: the requested case first, then the rest of the caller's
 *  feed so they can keep scrolling instead of hitting a dead end. */
export async function loadFeedFromDilemma(
  supabase: SupabaseClient,
  userId: string,
  startId: string,
  limit = 12
): Promise<DilemmaCardData[]> {
  const [{ data: myVotes }, { data: myProfile }] = await Promise.all([
    supabase.from('votes').select('dilemma_id').eq('voter_id', userId),
    supabase.from('profiles').select('is_premium, handle').eq('id', userId).maybeSingle(),
  ]);
  const votedIds = (myVotes ?? []).map((v) => v.dilemma_id);

  let query = supabase
    .from('dilemmas')
    .select('id')
    .eq('status', 'live')
    .neq('id', startId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const exclude = votedIds.filter((id) => id !== startId);
  if (exclude.length) {
    query = query.not('id', 'in', `(${exclude.join(',')})`);
  }
  const { data: rows } = await query;
  const ids = [startId, ...(rows ?? []).map((r) => r.id)];

  const cards = await Promise.all(
    ids.map((id) => loadDilemmaCardData(supabase, userId, id, myProfile ?? undefined))
  );
  return cards.filter((c): c is DilemmaCardData => c !== null);
}
