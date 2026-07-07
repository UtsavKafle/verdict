-- Verdict — post images + author-sees-own-results
--
-- Adds: an image_urls column on dilemmas, a public storage bucket for those
-- images (+ its RLS), and a tweak so a dilemma's author can view their own
-- poll results without voting (they're the one person who structurally can't
-- vote on it). Idempotent — safe to re-run.

------------------------------------------------------------------
-- 1. Image URLs on dilemmas (max 5 enforced in the app layer)
------------------------------------------------------------------

alter table dilemmas add column if not exists image_urls text[] not null default '{}';

------------------------------------------------------------------
-- 2. Public storage bucket for post images
------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('dilemma-images', 'dilemma-images', true)
on conflict (id) do nothing;

-- Anyone may read (bucket is public; be explicit for the objects table too).
drop policy if exists dilemma_images_read on storage.objects;
create policy dilemma_images_read on storage.objects
  for select to public
  using (bucket_id = 'dilemma-images');

-- Authenticated users may upload only into their own folder: <uid>/<file>.
drop policy if exists dilemma_images_insert_own on storage.objects;
create policy dilemma_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dilemma-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

------------------------------------------------------------------
-- 3. get_verdict: also allow the author to see their own poll.
-- The author can't cast a vote on their own case, so gating them on
-- "have you voted?" would forever hide their own results. Everyone else
-- still has to vote first — the honesty rule is unchanged for voters.
------------------------------------------------------------------

create or replace function get_verdict(p_dilemma_id uuid)
returns table (choice text, cnt bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from votes
    where dilemma_id = p_dilemma_id and voter_id = auth.uid()
  ) and not exists (
    select 1 from dilemmas
    where id = p_dilemma_id and author_id = auth.uid()
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
-- 4. get_verdict_breakdown: same author bypass on the vote gate
-- (still gated on premium + the 10-vote-per-segment floor).
------------------------------------------------------------------

create or replace function get_verdict_breakdown(p_dilemma_id uuid, p_dimension text)
returns table (segment text, a_count bigint, b_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from votes where dilemma_id = p_dilemma_id and voter_id = auth.uid())
     and not exists (select 1 from dilemmas where id = p_dilemma_id and author_id = auth.uid()) then
    raise exception 'not_voted';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and is_premium) then
    raise exception 'not_premium';
  end if;

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
