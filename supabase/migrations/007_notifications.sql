create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null default 'system',
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}',
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_created_at_idx on public.notifications(created_at desc);

alter table public.notifications enable row level security;

-- Authenticated users can read their own notifications
create policy "users read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can mark their own notifications as read
create policy "users update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- SECURITY DEFINER function so admin can broadcast from SQL editor
-- bypasses RLS and can read auth.users
create or replace function public.broadcast_notification(
  p_type  text,
  p_title text,
  p_body  text,
  p_data  jsonb default '{}'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.notifications(user_id, type, title, body, data)
  select id, p_type, p_title, p_body, p_data
  from auth.users;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only superuser/service role can call this directly; revoke from public roles
revoke execute on function public.broadcast_notification(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.broadcast_notification(text, text, text, jsonb) to service_role;
