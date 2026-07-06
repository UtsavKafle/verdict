'use server';

import { createClient } from '@/lib/supabase/server';

// Upgrades the current anonymous session into a claimed pseudonymous identity.
// Same auth user / session — we only fill in the profiles row and flip
// is_anonymous. Demographics are optional and are captured here solely to
// power demographic-filtered verdicts later (breakdown + targeting).
export async function claimHandle(input: {
  handle: string;
  ageBand: string | null;
  gender: string | null;
}): Promise<{ data: { handle: string } } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const handle = input.handle.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) return { error: 'invalid_handle' };

  const { error } = await supabase
    .from('profiles')
    .update({
      handle,
      age_band: input.ageBand,
      gender: input.gender,
      is_anonymous: false,
    })
    .eq('id', user.id);

  if (error) {
    if (
      error.code === '23505' ||
      error.message.includes('duplicate') ||
      error.message.includes('unique')
    ) {
      return { error: 'handle_taken' };
    }
    return { error: error.message };
  }

  return { data: { handle } };
}
