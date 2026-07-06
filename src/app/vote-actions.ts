'use server';

import { createClient } from '@/lib/supabase/server';

export type VerdictRow = { choice: string; cnt: number };

export async function voteAndReveal(
  dilemmaId: string,
  choice: 'a' | 'b'
): Promise<{ data: VerdictRow[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const { error: voteError } = await supabase
    .from('votes')
    .insert({ dilemma_id: dilemmaId, voter_id: user.id, choice });

  // A duplicate (already voted, e.g. a double-tap race) isn't fatal — fall
  // through and return the real tally either way.
  if (voteError && !voteError.message.includes('duplicate key')) {
    return { error: voteError.message };
  }

  const { data, error } = await supabase.rpc('get_verdict', {
    p_dilemma_id: dilemmaId,
  });
  if (error) return { error: error.message };

  return { data: data as VerdictRow[] };
}
