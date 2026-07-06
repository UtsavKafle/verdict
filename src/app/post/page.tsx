import { createClient } from '@/lib/supabase/server';
import { ComposeForm } from '@/components/compose-form';

export default async function PostPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 font-meta text-sm text-muted-2">
        Signing you in…
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium, handle')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <ComposeForm
      initialIsPremium={profile?.is_premium ?? false}
      initialHasHandle={!!profile?.handle}
    />
  );
}
