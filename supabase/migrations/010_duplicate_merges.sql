CREATE TABLE public.duplicate_merges (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         TEXT NOT NULL CHECK (type IN ('finding', 'person')),
  winner_id    UUID NOT NULL,
  loser_id     UUID NOT NULL,
  merged_by    UUID REFERENCES auth.users(id),
  merged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.duplicate_merges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read duplicate_merges"
  ON public.duplicate_merges FOR SELECT USING (true);

CREATE POLICY "Auth insert duplicate_merges"
  ON public.duplicate_merges FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
