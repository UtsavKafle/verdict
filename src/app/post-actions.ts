'use server';

import { createClient } from '@/lib/supabase/server';

export async function createDilemma(input: {
  body: string;
  category: string;
  targetGender: string | null;
  targetAgeBand: string | null;
}): Promise<{ data: { id: string } } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const trimmed = input.body.trim();
  if (trimmed.length < 10 || trimmed.length > 600) return { error: 'invalid_length' };

  // Defense in depth: only a (mock) premium author's targeting choice is
  // ever persisted, regardless of what the client sends. This is what
  // backs the hard guardrail — targeting never restricts who can vote, and
  // a non-premium request can't sneak a target through a raw insert.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .maybeSingle();
  const isPremium = profile?.is_premium ?? false;

  const { data, error } = await supabase
    .from('dilemmas')
    .insert({
      author_id: user.id,
      body: trimmed,
      category: input.category,
      target_gender: isPremium ? input.targetGender : null,
      target_age_band: isPremium ? input.targetAgeBand : null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { data };
}
