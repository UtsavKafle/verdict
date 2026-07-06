'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Ensures every visitor has a session. Anonymous sign-in must be triggered
// client-side (there's no session yet for a server component to read).
// Once it lands, refresh so server components pick up the new session cookie.
export function AuthBootstrap() {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    // Guards against React Strict Mode's double effect-invoke in dev, which
    // would otherwise race two signInAnonymously() calls and create two users.
    if (startedRef.current) return;
    startedRef.current = true;

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        supabase.auth.signInAnonymously().then(({ error }) => {
          if (error) {
            console.error('Anonymous sign-in failed', error);
            return;
          }
          router.refresh();
        });
      }
    });
  }, [router]);

  return null;
}
