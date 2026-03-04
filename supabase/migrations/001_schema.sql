-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- FINDINGS: main corruption cases
-- ============================================================
CREATE TABLE IF NOT EXISTS findings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('critico', 'alto', 'medio', 'bajo')),
  category      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'archivado', 'resuelto')),
  amount_usd    BIGINT,            -- total money involved in USD
  date_reported DATE,
  date_occurred DATE,
  source_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_category ON findings(category);
CREATE INDEX idx_findings_created_at ON findings(created_at DESC);
CREATE INDEX idx_findings_title_trgm ON findings USING GIN (title gin_trgm_ops);

-- ============================================================
-- PEOPLE: public figures
-- ============================================================
CREATE TABLE IF NOT EXISTS people (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  role            TEXT,              -- e.g. "Ex-Presidente", "Ministro de Obras Públicas"
  institution     TEXT,              -- e.g. "Gobierno de Panamá"
  nationality     TEXT DEFAULT 'PA',
  is_public_figure BOOLEAN DEFAULT TRUE,
  photo_url       TEXT,
  bio             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_people_name_trgm ON people USING GIN (name gin_trgm_ops);

-- ============================================================
-- FINDING_PEOPLE: junction table — who is in which finding
-- ============================================================
CREATE TABLE IF NOT EXISTS finding_people (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id    UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role_in_case  TEXT,              -- e.g. "Principal acusado", "Intermediario"
  amount_usd    BIGINT,            -- amount this person allegedly received/stole
  is_convicted  BOOLEAN DEFAULT FALSE,
  notes         TEXT,
  UNIQUE(finding_id, person_id)
);

CREATE INDEX idx_fp_finding ON finding_people(finding_id);
CREATE INDEX idx_fp_person ON finding_people(person_id);

-- ============================================================
-- PERSON_RELATIONSHIPS: edges between people
-- ============================================================
CREATE TABLE IF NOT EXISTS person_relationships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_a_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship    TEXT NOT NULL CHECK (relationship IN ('familiar', 'socio_comercial', 'politico', 'empleado', 'otro')),
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (person_a_id <> person_b_id)
);

CREATE INDEX idx_rel_a ON person_relationships(person_a_id);
CREATE INDEX idx_rel_b ON person_relationships(person_b_id);

-- ============================================================
-- SOURCES: news articles / evidence per finding
-- ============================================================
CREATE TABLE IF NOT EXISTS sources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id  UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT,
  outlet      TEXT,
  published_at DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sources_finding ON sources(finding_id);

-- ============================================================
-- SCRAPE_LOG: tracks each cron run
-- ============================================================
CREATE TABLE IF NOT EXISTS scrape_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sources_checked   INTEGER DEFAULT 0,
  articles_found    INTEGER DEFAULT 0,
  findings_created  INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
  error_message     TEXT,
  duration_ms       INTEGER
);

-- ============================================================
-- Auto-update updated_at on findings
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER findings_updated_at
  BEFORE UPDATE ON findings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row-level security (read-only public access)
-- ============================================================
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read findings" ON findings FOR SELECT USING (true);
CREATE POLICY "Public read people" ON people FOR SELECT USING (true);
CREATE POLICY "Public read finding_people" ON finding_people FOR SELECT USING (true);
CREATE POLICY "Public read person_relationships" ON person_relationships FOR SELECT USING (true);
CREATE POLICY "Public read sources" ON sources FOR SELECT USING (true);
CREATE POLICY "Public read scrape_log" ON scrape_log FOR SELECT USING (true);
