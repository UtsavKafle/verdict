'use server';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_LABEL_PRESET, isValidLabelPair } from '@/lib/label-presets';

export async function createDilemma(input: {
  body: string;
  category: string;
  targetGender: string | null;
  targetAgeBand: string | null;
  imageUrls?: string[];
  labelA?: string;
  labelB?: string;
}): Promise<{ data: { id: string } } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const trimmed = input.body.trim();
  if (trimmed.length < 10 || trimmed.length > 600) return { error: 'invalid_length' };

  // Cap attached images at 5, keep only well-formed string URLs.
  const imageUrls = (input.imageUrls ?? [])
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, 5);

  // Labels are a preset picker, not free text — only accept a pair that
  // exactly matches a curated preset; otherwise fall back to the default.
  // Side A always maps to the plum/left button, side B to teal/right.
  const validPair = isValidLabelPair(input.labelA ?? '', input.labelB ?? '');
  const labelA = validPair ? input.labelA! : DEFAULT_LABEL_PRESET.a;
  const labelB = validPair ? input.labelB! : DEFAULT_LABEL_PRESET.b;

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
      label_a: labelA,
      label_b: labelB,
      target_gender: isPremium ? input.targetGender : null,
      target_age_band: isPremium ? input.targetAgeBand : null,
      image_urls: imageUrls,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { data };
}
