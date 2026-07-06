-- Verdict v1 — initial schema
-- Phase 1: data model, triggers, RPC, and RLS policies.
-- Ordering matters: tables → triggers on auth.users → RPCs → RLS.

------------------------------------------------------------------
-- 1. TABLES
------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique,
  age_band      text,            -- captured on first contribution; powers paid filters LATER
  gender        text,
  is_anonymous  boolean not null default true,
  created_at    timestamptz not null default now()
);

create table dilemmas (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 10 and 600),
  category    text,                            -- e.g. DATING, ROOMMATES, FAMILY, MONEY
  label_a     text not null default 'NTA',
  label_b     text not null default 'YTA',
  status      text not null default 'live',    -- live | settled | removed
  created_at  timestamptz not null default now()
);
create index dilemmas_status_created_idx on dilemmas (status, created_at desc);

create table votes (
  id          uuid primary key default gen_random_uuid(),
  dilemma_id  uuid not null references dilemmas(id) on delete cascade,
  voter_id    uuid not null references profiles(id) on delete cascade,
  choice      text not null check (choice in ('a','b')),   -- a = NTA (plum), b = YTA (teal)
  created_at  timestamptz not null default now(),
  unique (dilemma_id, voter_id)
);
create index votes_voter_idx on votes (voter_id);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  dilemma_id  uuid not null references dilemmas(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 280),
  choice      text not null check (choice in ('a','b')),   -- derived from author's vote, server-side
  upvotes     int not null default 0,
  created_at  timestamptz not null default now()
);
create index comments_dilemma_upvotes_idx on comments (dilemma_id, upvotes desc, created_at desc);

create table comment_votes (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references comments(id) on delete cascade,
  voter_id    uuid not null references profiles(id) on delete cascade,
  unique (comment_id, voter_id)
);

create table reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('dilemma','comment')),
  target_id    uuid not null,
  reporter_id  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

------------------------------------------------------------------
-- 2. TRIGGERS
------------------------------------------------------------------

-- Auto-create a profiles row for every auth.users insert (including anonymous).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, is_anonymous)
  values (new.id, coalesce(new.is_anonymous, true));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Derive a comment's choice from the author's real vote — client-supplied value is overwritten.
-- Also enforces "must vote before commenting" at the DB layer.
create or replace function set_comment_choice()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_choice text;
begin
  select choice into v_choice
  from votes
  where dilemma_id = new.dilemma_id and voter_id = new.author_id;

  if v_choice is null then
    raise exception 'must_vote_before_commenting';
  end if;

  new.choice := v_choice;
  return new;
end; $$;

create trigger comment_choice_before_insert
  before insert on comments
  for each row execute function set_comment_choice();

-- Bump comments.upvotes when a comment_votes row is inserted.
create or replace function bump_comment_upvotes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update comments set upvotes = upvotes + 1 where id = new.comment_id;
  return new;
end; $$;

create trigger comment_votes_after_insert
  after insert on comment_votes
  for each row execute function bump_comment_upvotes();

------------------------------------------------------------------
-- 3. RPC — the honesty guarantee
------------------------------------------------------------------

-- Returns tallies ONLY if the caller has already voted on this dilemma.
-- Client code never sees raw vote rows; this is the only tally surface.
create or replace function get_verdict(p_dilemma_id uuid)
returns table (choice text, cnt bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from votes
    where dilemma_id = p_dilemma_id and voter_id = auth.uid()
  ) then
    raise exception 'not_voted';
  end if;

  return query
    select v.choice, count(*)::bigint
    from votes v
    where v.dilemma_id = p_dilemma_id
    group by v.choice;
end; $$;

revoke all on function get_verdict(uuid) from public;
grant execute on function get_verdict(uuid) to authenticated;

------------------------------------------------------------------
-- 4. RLS
------------------------------------------------------------------

alter table profiles      enable row level security;
alter table dilemmas      enable row level security;
alter table votes         enable row level security;
alter table comments      enable row level security;
alter table comment_votes enable row level security;
alter table reports       enable row level security;

-- profiles: any authenticated user can read (for handles); users update only their own row.
create policy profiles_select_all on profiles
  for select to authenticated using (true);

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- dilemmas: authenticated can read live dilemmas, plus their own regardless of status.
create policy dilemmas_select_live_or_own on dilemmas
  for select to authenticated
  using (status = 'live' or author_id = auth.uid());

-- Insert only as yourself.
create policy dilemmas_insert_own on dilemmas
  for insert to authenticated
  with check (author_id = auth.uid());

-- votes: users may only insert their own vote row; they may read only their own votes.
-- Tallies come exclusively via get_verdict(), never by direct select.
create policy votes_insert_own on votes
  for insert to authenticated
  with check (voter_id = auth.uid());

create policy votes_select_own on votes
  for select to authenticated
  using (voter_id = auth.uid());

-- comments: readable on any live dilemma; insertable only after author has voted on that dilemma.
create policy comments_select_on_live on comments
  for select to authenticated
  using (
    exists (
      select 1 from dilemmas d
      where d.id = comments.dilemma_id and (d.status = 'live' or d.author_id = auth.uid())
    )
  );

create policy comments_insert_after_vote on comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from votes
      where dilemma_id = comments.dilemma_id and voter_id = auth.uid()
    )
  );

-- comment_votes: users insert only their own; can read only their own rows (aggregate lives on comments.upvotes).
create policy comment_votes_insert_own on comment_votes
  for insert to authenticated
  with check (voter_id = auth.uid());

create policy comment_votes_select_own on comment_votes
  for select to authenticated
  using (voter_id = auth.uid());

-- reports: any authenticated user can insert; nobody selects via the API (moderation reads happen via Supabase table editor / service role).
create policy reports_insert_any on reports
  for insert to authenticated
  with check (reporter_id is null or reporter_id = auth.uid());
