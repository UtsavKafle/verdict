'use server';

import { createClient } from '@/lib/supabase/server';

export type CommentRow = {
  id: string;
  body: string;
  choice: 'a' | 'b';
  upvotes: number;
  createdAt: string;
  authorId: string;
  handle: string | null;
};

function normalizeHandle(profiles: unknown): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) {
    return (profiles[0] as { handle?: string | null } | undefined)?.handle ?? null;
  }
  return (profiles as { handle?: string | null }).handle ?? null;
}

export async function getComments(
  dilemmaId: string
): Promise<{ data: CommentRow[]; myUpvotes: string[]; userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const { data, error } = await supabase
    .from('comments')
    .select('id, body, choice, upvotes, created_at, author_id, profiles(handle)')
    .eq('dilemma_id', dilemmaId)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  const rows: CommentRow[] = (data ?? []).map((c) => ({
    id: c.id as string,
    body: c.body as string,
    choice: c.choice as 'a' | 'b',
    upvotes: c.upvotes as number,
    createdAt: c.created_at as string,
    authorId: c.author_id as string,
    handle: normalizeHandle(c.profiles),
  }));

  const ids = rows.map((c) => c.id);
  let myUpvotes: string[] = [];
  if (ids.length) {
    const { data: myVotes } = await supabase
      .from('comment_votes')
      .select('comment_id')
      .eq('voter_id', user.id)
      .in('comment_id', ids);
    myUpvotes = (myVotes ?? []).map((v) => v.comment_id as string);
  }

  return { data: rows, myUpvotes, userId: user.id };
}

export async function postComment(
  dilemmaId: string,
  body: string
): Promise<{ data: CommentRow } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 280) return { error: 'invalid_length' };

  const { data, error } = await supabase
    .from('comments')
    .insert({ dilemma_id: dilemmaId, author_id: user.id, body: trimmed })
    .select('id, body, choice, upvotes, created_at, author_id, profiles(handle)')
    .single();

  if (error) return { error: error.message };

  return {
    data: {
      id: data.id as string,
      body: data.body as string,
      choice: data.choice as 'a' | 'b',
      upvotes: data.upvotes as number,
      createdAt: data.created_at as string,
      authorId: data.author_id as string,
      handle: normalizeHandle(data.profiles),
    },
  };
}

export async function upvoteComment(commentId: string): Promise<{ data: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'no_session' };

  const { error } = await supabase
    .from('comment_votes')
    .insert({ comment_id: commentId, voter_id: user.id });

  if (error && !error.message.includes('duplicate key')) {
    return { error: error.message };
  }
  return { data: true };
}
