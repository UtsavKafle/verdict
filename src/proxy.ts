import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals + static assets + PWA files
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
