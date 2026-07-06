'use server';

import { createClient } from '@/lib/supabase/server';

export type SearchResult = {
  id: string;
  body: string;
  category: string | null;
  authorHandle: string | null;
  voteCount: number;
};

// TODO: this is a simple ILIKE scan, fine at seed scale (dozens–low
// hundreds of rows). Once dilemma volume grows, upgrade to Postgres
// full-text search (a generated tsvector column + GIN index) instead of
// widening this ILIKE.
export async function searchDilemmas(
  query: string,
  category: string | null
): Promise<{ data: SearchResult[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  let dbQuery = supabase
    .from('dilemmas')
    .select('id, body, category, author_id, profiles(handle)')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(30);

  if (query.trim()) {
    dbQuery = dbQuery.ilike('body', `%${query.trim()}%`);
  }
  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  const { data, error } = await dbQuery;
  if (error) return { error: error.message };

  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);

  let counts = new Map<string, number>();
  if (ids.length) {
    const { data: countRows } = await supabase.rpc('get_dilemma_vote_counts', {
      p_dilemma_ids: ids,
    });
    counts = new Map((countRows ?? []).map((c: { dilemma_id: string; cnt: number }) => [c.dilemma_id, c.cnt]));
  }

  return {
    data: rows.map((r) => {
      const profiles = r.profiles as { handle?: string | null } | { handle?: string | null }[] | null;
      const handle = Array.isArray(profiles) ? profiles[0]?.handle : profiles?.handle;
      return {
        id: r.id as string,
        body: r.body as string,
        category: r.category as string | null,
        authorHandle: handle ?? null,
        voteCount: counts.get(r.id as string) ?? 0,
      };
    }),
  };
}
