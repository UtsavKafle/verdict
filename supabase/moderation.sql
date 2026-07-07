-- Verdict — moderation queries
-- Run these in the Supabase SQL editor (runs with elevated rights, so it
-- bypasses RLS — reports has no public read policy by design).

------------------------------------------------------------------
-- 1. LIST OPEN REPORTS
-- Every report, newest first, with the reported item's text inlined so you
-- can judge it without a second lookup. `status` is only meaningful for
-- dilemmas (comments have no status column); it shows NULL for comments.
------------------------------------------------------------------

select
  r.id            as report_id,
  r.target_type,
  r.target_id,
  r.reporter_id,
  r.created_at,
  case r.target_type
    when 'dilemma' then (select d.body from dilemmas d where d.id = r.target_id)
    when 'comment' then (select c.body from comments c where c.id = r.target_id)
  end             as target_body,
  case r.target_type
    when 'dilemma' then (select d.status from dilemmas d where d.id = r.target_id)
  end             as dilemma_status
from reports r
order by r.created_at desc;

------------------------------------------------------------------
-- 2. REMOVE A TARGET
-- Dilemmas carry a status, so "removing" one is a soft-remove: it drops out
-- of every feed/search (all reads filter status='live') but the row and its
-- votes/comments are preserved. Replace the id and run.
------------------------------------------------------------------

update dilemmas
set status = 'removed'
where id = '00000000-0000-0000-0000-000000000000';  -- <-- dilemma id to remove

-- Comments have no status column, so removing a comment is a hard delete
-- (its comment_votes cascade away). Replace the id and run.
-- delete from comments
-- where id = '00000000-0000-0000-0000-000000000000';  -- <-- comment id to remove
