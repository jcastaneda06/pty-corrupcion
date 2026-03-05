-- Require authentication for reactions and comments
-- Existing anonymous data cannot be backfilled with user_id, so we truncate

truncate table public.reactions;
truncate table public.finding_comments;

-- ── reactions ──────────────────────────────────────────────────────────────

alter table public.reactions
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table public.reactions
  add constraint reactions_user_finding_emoji_unique
  unique (user_id, finding_id, emoji);

drop policy if exists "public insert reactions" on public.reactions;

create policy "auth insert reactions"
  on public.reactions for insert
  with check (auth.uid() = user_id);

create policy "auth delete reactions"
  on public.reactions for delete
  using (auth.uid() = user_id);

-- ── finding_comments ───────────────────────────────────────────────────────

alter table public.finding_comments
  add column user_id uuid not null references auth.users(id) on delete cascade;

drop policy if exists "public insert finding_comments" on public.finding_comments;

create policy "auth insert finding_comments"
  on public.finding_comments for insert
  with check (auth.uid() = user_id);
