# PTY Corrupción

A real-time corruption tracking dashboard for Panama. News articles are automatically scraped from Google News RSS feeds, analyzed by Gemini AI, and stored as structured findings with associated people, relationships, and sources.

## What it does

- **Automated scraping** — a Supabase Edge Function runs on a cron schedule, fetches Panama-related news from ~36 Google News RSS queries, filters out irrelevant articles, clusters articles about the same case, and uses Gemini 2.5 Flash to extract structured corruption findings
- **Findings database** — each case is stored with severity (`critico` / `alto` / `medio` / `bajo`), category, dollar amounts, dates, involved people, and source URLs
- **Relationship graph** — people mentioned across findings are linked by relationship type (family, business, political, employer, etc.) and visualized as a node graph
- **Corruption Index** — historical chart of Panama's Transparency International CPI score (2012–2024) overlaid with presidential terms and public debt

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS
- **Data fetching** — TanStack React Query (5-minute stale time)
- **Routing** — React Router v6 (`/`, `/hallazgos`, `/hallazgos/:id`, `/personas/:id`, `/indice`)
- **Charts** — Recharts (CPI history), @xyflow/react (relationship graph)
- **Backend** — Supabase (Postgres + Edge Functions + Row Level Security)
- **AI** — Google Gemini 2.5 Flash (article extraction and clustering)
- **Deployment** — Vercel (frontend)

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd pty-corrupcion
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

For the `merge-duplicate-findings` script only, also add:
```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Set up the database

```bash
supabase db push
# or apply migrations manually:
# supabase/migrations/001_schema.sql
# supabase/migrations/002_seed.sql
# supabase/migrations/003_fix_sources.sql
```

### 4. Deploy the edge function

```bash
supabase functions deploy scrape-analyze
supabase secrets set GEMINI_API_KEY=AIza...
```

### 5. Run locally

```bash
npm run dev
```

## Scraping pipeline

The `scrape-analyze` edge function processes articles in this order:

1. Fetch ~36 Google News RSS feeds in parallel (5 articles each)
2. Deduplicate by URL in memory
3. Filter out URLs already in the `sources` table (last 60 days)
4. **Pre-screen** remaining articles with one Gemini call — drops irrelevant articles (sports, weather, etc.) based on title/description only
5. **Cluster** the relevant articles into topic groups with one Gemini call — articles about the same case are merged
6. **Extract** each group: Gemini reads RSS title + description and returns structured JSON (title, summary, severity, category, amount, people, relationships)
7. Insert findings, sources, people, and relationships into the database

A hard cap of 25 groups per run keeps execution within Supabase's wall-clock limits. Run the function every 4–6 hours via pg_cron for full daily coverage.

## Utility scripts

**Merge duplicate findings** (one-time cleanup):

```bash
node scripts/merge-duplicate-findings.mjs [--dry-run]
```

Uses Claude to cluster existing findings by topic, picks a winner per group by severity, rewrites a consolidated summary, moves all sources and people to the winner, and deletes duplicates.

**Backfill source titles**:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/backfill-source-titles
# or: supabase functions invoke backfill-source-titles
```

Fills in null `title` fields in the `sources` table by fetching the HTML `<title>` tag from each URL.

## Database schema

| Table | Description |
|---|---|
| `findings` | Corruption cases — title, summary, severity, category, amount, dates |
| `people` | Individuals mentioned across cases |
| `finding_people` | Junction: who appears in which finding, their role, conviction status |
| `person_relationships` | Graph edges between people (family, business, political, etc.) |
| `sources` | News article URLs and metadata per finding |
| `scrape_log` | Audit log of each automated scrape run |

All tables are publicly readable via RLS. Writes require the service role key (edge functions only).
