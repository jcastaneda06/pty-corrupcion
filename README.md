# PTY Corrupción

A real-time corruption tracking dashboard for Panama. News articles are automatically scraped, analyzed by AI, and surfaced as structured cases with people, money trails, and source links.

## How it works

### Automated data collection

A Supabase Edge Function runs on a cron schedule and feeds the database automatically:

1. **Fetch** — ~36 Google News RSS queries covering Panama corruption, government misconduct, public procurement fraud, and institutional abuse (SENNIAF, hospitals, prisons, etc.)
2. **Deduplicate** — articles already in the database are skipped using a URL lookup against the `sources` table
3. **Pre-screen** — one Gemini call reads all article titles and discards irrelevant results (sports, weather, traffic) before any expensive processing happens
4. **Cluster** — a second Gemini call groups articles about the same case together so they produce one consolidated finding instead of duplicates
5. **Extract** — for each group, Gemini reads the RSS title and description and returns structured JSON: title, summary, severity, category, dollar amount, date, involved people, and their relationships
6. **Persist** — findings, sources, people, and relationships are inserted into Postgres; the run is logged to `scrape_log`

### Severity levels

Each finding is classified by Gemini at ingestion time:

| Level | Criteria |
|---|---|
| `critico` | >$1M involved, multiple officials, confirmed criminal charges |
| `alto` | Confirmed corruption, significant amounts or senior officials |
| `medio` | Under formal investigation, credible evidence but no conviction |
| `bajo` | Minor administrative irregularities, early-stage alerts |

### Categories

Cases are bucketed into one of ten categories: Fraude en Contratación Pública, Peculado / Malversación, Lavado de Dinero, Soborno / Cohecho, Tráfico de Influencias, Captura del Estado, Abuso en Emergencias, Corrupción en Seguridad, Negligencia y Abuso Institucional, Violación de Derechos Humanos.

### People and relationships

Every person extracted from an article is upserted into a shared `people` table by name. If the same person appears across multiple findings they accumulate a full case history. Relationships between people (family, business partners, political ties, employer/employee) are stored as graph edges and visualized as an interactive network on each person's profile page.

### Corruption Index

The `/indice` page shows Panama's historical score on Transparency International's Corruption Perceptions Index from 2012 to 2024, overlaid with presidential terms and public debt as a percentage of GDP.

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind CSS, React Router v6
- **Data fetching** — TanStack React Query
- **Visualizations** — Recharts (CPI chart), @xyflow/react (relationship graph)
- **Backend** — Supabase (Postgres, Edge Functions, Row Level Security)
- **AI** — Google Gemini 2.5 Flash
- **Deployment** — Vercel
