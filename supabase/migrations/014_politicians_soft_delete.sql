ALTER TABLE public.politicians ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Admins can soft-delete politicians
CREATE POLICY "Admins delete politicians"
  ON public.politicians FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
