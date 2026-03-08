CREATE TABLE IF NOT EXISTS public.politicians (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id         UUID NOT NULL UNIQUE REFERENCES public.people(id) ON DELETE CASCADE,
  political_position TEXT,
  political_party    TEXT,
  tenure_start       DATE,
  tenure_end         DATE,
  photo_url          TEXT,
  photo_source_url   TEXT,
  photo_source_name  TEXT,
  is_processed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_politicians_person     ON public.politicians(person_id);
CREATE INDEX idx_politicians_position   ON public.politicians(political_position);
CREATE INDEX idx_politicians_processed  ON public.politicians(is_processed);

ALTER TABLE public.politicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read politicians" ON public.politicians FOR SELECT USING (true);
