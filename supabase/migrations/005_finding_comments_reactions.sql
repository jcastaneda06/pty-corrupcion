-- Per-finding comments (name + email required, no auth)
create table if not exists public.finding_comments (
  id           uuid primary key default gen_random_uuid(),
  finding_id   uuid not null references public.findings(id) on delete cascade,
  author_name  text not null check (char_length(author_name) between 1 and 100),
  author_email text not null check (author_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  content      text not null check (char_length(content) between 1 and 2000),
  created_at   timestamptz not null default now()
);

alter table public.finding_comments enable row level security;

create policy "public read finding_comments"
  on public.finding_comments for select using (true);

create policy "public insert finding_comments"
  on public.finding_comments for insert with check (true);

create index if not exists finding_comments_finding_id_idx
  on public.finding_comments (finding_id, created_at desc);

-- Per-finding emoji reactions (anonymous, no rate limiting by design)
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  finding_id  uuid not null references public.findings(id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 10),
  created_at  timestamptz not null default now()
);

alter table public.reactions enable row level security;

create policy "public read reactions"
  on public.reactions for select using (true);

create policy "public insert reactions"
  on public.reactions for insert with check (true);

create index if not exists reactions_finding_id_idx
  on public.reactions (finding_id);
