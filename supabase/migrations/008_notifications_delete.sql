create policy "users delete own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_id);
