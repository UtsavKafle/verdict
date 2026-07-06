-- Verdict — Change Spec 4.5
-- Adds: demographic targeting columns, mock premium flag, unlock_events
-- (paywall demand signal), the verdict-breakdown RPC, and one addition of
-- our own (get_dilemma_vote_counts — see note below).
-- No schema changes needed for the post FAB or search: search reads
-- dilemmas.body/category which are already selectable under the existing
-- "live dilemmas are readable" RLS policy.

------------------------------------------------------------------
-- 1. Targeting columns on dilemmas
------------------------------------------------------------------

-- null = everyone (default). Setting these NEVER restricts who can vote —
-- they only affect feed ordering + which slice is the poster's headline
-- result. Enforced by the app layer at write time (see createDilemma),
-- not by RLS, since column-level permission isn't something Postgres RLS
-- does natively and the premium gate itself is intentionally mocked in v1.
alter table dilemmas add column if not exists target_gender text;
alter table dilemmas add column if not exists target_age_band text;

------------------------------------------------------------------
-- 2. Mock premium flag
------------------------------------------------------------------

alter table profiles add column if not exists is_premium boolean not null default false;

------------------------------------------------------------------
-- 3. Unlock events — the only thing v1 actually "sells": the signal that
-- someone tried to unlock a premium surface.
------------------------------------------------------------------

create table if not exists unlock_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  surface     text not null check (surface in ('targeting', 'breakdown')),
  dilemma_id  uuid references dilemmas(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table unlock_events enable row level security;

-- Authenticated users may log their own unlock attempts. No select policy —
-- this is a write-only funnel measured via the table editor / service role.
drop policy if exists unlock_events_insert_own on unlock_events;
create policy unlock_events_insert_own on unlock_events
  for insert to authenticated
  with check (user_id = auth.uid());

------------------------------------------------------------------
-- 4. Verdict breakdown RPC — real per-segment data, gated on:
--    (a) caller has voted (same honesty rule as get_verdict)
--    (b) caller is (mock) premium
--    (c) segment has at least 10 votes (stats + anonymity floor)
------------------------------------------------------------------

create or replace function get_verdict_breakdown(p_dilemma_id uuid, p_dimension text)
returns table (segment text, a_count bigint, b_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from votes where dilemma_id = p_dilemma_id and voter_id = auth.uid()) then
    raise exception 'not_voted';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and is_premium) then
    raise exception 'not_premium';
  end if;

  -- NOTE: the CTE column is named seg_value (not "segment") and every
  -- reference below is table-qualified. RETURNS TABLE makes segment/a_count/
  -- b_count OUT parameters, so an unqualified "group by segment" would be
  -- ambiguous and PL/pgSQL (variable_conflict = error, the default) aborts —
  -- which rolls back the whole migration. Qualifying avoids that entirely,
  -- same reason get_verdict uses "v.choice" rather than a bare "choice".
  return query
  with seg as (
    select
      case p_dimension
        when 'gender' then p.gender
        when 'age'    then p.age_band
        else 'all'
      end as seg_value,
      v.choice as seg_choice
    from votes v
    join profiles p on p.id = v.voter_id
    where v.dilemma_id = p_dilemma_id
      and (case p_dimension when 'gender' then p.gender when 'age' then p.age_band end) is not null
  )
  select seg.seg_value,
         count(*) filter (where seg.seg_choice = 'a'),
         count(*) filter (where seg.seg_choice = 'b')
  from seg
  group by seg.seg_value
  having count(*) >= 10;
end; $$;

revoke all on function get_verdict_breakdown(uuid, text) from public;
grant execute on function get_verdict_breakdown(uuid, text) to authenticated;

------------------------------------------------------------------
-- 5. ADDITION (not in the original change-spec SQL): get_dilemma_vote_counts
--
-- Search results need to show a total vote count per dilemma. votes' RLS
-- ("votes_select_own") restricts SELECT to the caller's own row, so a plain
-- client-side count() would only ever see 0 or 1, never the true total.
-- This returns ONLY an aggregate total per dilemma — no per-side split —
-- so it can't reveal which side is winning and doesn't weaken the
-- "results hidden until you vote" guarantee; it's the same honesty
-- boundary as get_verdict, just without the split. Not gated on having
-- voted, since a bare count carries no spoiler information.
------------------------------------------------------------------

create or replace function get_dilemma_vote_counts(p_dilemma_ids uuid[])
returns table (dilemma_id uuid, cnt bigint)
language sql security definer set search_path = public as $$
  select v.dilemma_id, count(*)::bigint
  from votes v
  where v.dilemma_id = any(p_dilemma_ids)
  group by v.dilemma_id;
$$;

revoke all on function get_dilemma_vote_counts(uuid[]) from public;
grant execute on function get_dilemma_vote_counts(uuid[]) to authenticated;
