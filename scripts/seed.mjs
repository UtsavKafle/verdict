// Verdict — seed script
//
// Loads the dilemmas in scripts/dilemmas.json into your Supabase project,
// authored by a single "house" account (@thecourt). Idempotent: re-running
// replaces the house account's dilemmas rather than duplicating them.
//
// Requires the SERVICE ROLE key (bypasses RLS + can create the house auth
// user). Get it from: Supabase dashboard → Project Settings → API →
// `service_role` secret. Add it to .env.local as:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
// This key is powerful — never ship it to the browser / commit it.
//
// Usage:
//   node scripts/seed.mjs           # seed / re-seed the house dilemmas
//   node scripts/seed.mjs --clean   # also delete leftover TEST/throwaway cases

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Minimal .env.local loader (Node doesn't read it automatically).
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Add SUPABASE_SERVICE_ROLE_KEY to .env.local (dashboard → Settings → API → service_role).'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const HOUSE_EMAIL = 'house@verdict.local';
const HOUSE_HANDLE = 'thecourt';

async function ensureHouseAccount() {
  // Find an existing house user (paginate a little in case of many users).
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === HOUSE_EMAIL);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: HOUSE_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const clean = process.argv.includes('--clean');
  const dilemmas = JSON.parse(readFileSync(join(__dirname, 'dilemmas.json'), 'utf8'));

  const houseId = await ensureHouseAccount();
  await supabase
    .from('profiles')
    .update({ handle: HOUSE_HANDLE, is_anonymous: false })
    .eq('id', houseId);

  if (clean) {
    // Throwaway cases created during development (votes/comments cascade).
    const { error } = await supabase
      .from('dilemmas')
      .delete()
      .or(
        "category.eq.TEST,body.ilike.%diagnostic%,body.ilike.%Targeting test%,body.ilike.%Uniqueness test%,body.ilike.%not_voted gate%,body.ilike.%stray upvote%"
      );
    if (error) console.warn('cleanup warning:', error.message);
    else console.log('Cleaned up leftover test dilemmas.');
  }

  // Re-seedable: clear the house account's prior dilemmas first.
  await supabase.from('dilemmas').delete().eq('author_id', houseId);

  const rows = dilemmas.map((d) => ({
    author_id: houseId,
    body: d.body,
    category: d.category,
    status: 'live',
  }));

  const { data, error } = await supabase.from('dilemmas').insert(rows).select('id');
  if (error) throw error;

  console.log(`Seeded ${data.length} dilemmas as @${HOUSE_HANDLE}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
