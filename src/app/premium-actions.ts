'use server';

import { createClient } from '@/lib/supabase/server';

export type BreakdownRow = { segment: string; a_count: number; b_count: number };

export async function unlockPremium(
  surface: 'targeting' | 'breakdown',
  dilemmaId?: string
): Promise<{ data: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const { error: logError } = await supabase
    .from('unlock_events')
    .insert({ user_id: user.id, surface, dilemma_id: dilemmaId ?? null });
  if (logError) return { error: logError.message };

  // Mocked unlock for v1 — no real payment. This is what makes the whole
  // flow testable before any billing code exists.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_premium: true })
    .eq('id', user.id);
  if (updateError) return { error: updateError.message };

  return { data: true };
}

export async function getVerdictBreakdown(
  dilemmaId: string,
  dimension: 'gender' | 'age'
): Promise<{ data: BreakdownRow[] } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_verdict_breakdown', {
    p_dilemma_id: dilemmaId,
    p_dimension: dimension,
  });
  if (error) return { error: error.message };
  return { data: data as BreakdownRow[] };
}
