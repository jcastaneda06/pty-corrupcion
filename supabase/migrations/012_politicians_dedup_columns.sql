-- Add columns to track anonymous/duplicate people during politician classification
ALTER TABLE public.politicians
  ADD COLUMN IF NOT EXISTS is_skipped_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_duplicate_of UUID REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_politicians_duplicate_of ON public.politicians(is_duplicate_of);
