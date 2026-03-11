# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server
npm run build      # tsc + vite build
npm run lint       # ESLint (zero warnings allowed) — currently fails due to missing ESLint config; use npm run build to validate TypeScript instead
npm run preview    # preview production build

# Supabase edge functions
supabase functions deploy scrape-analyze
supabase functions deploy backfill-source-titles
supabase secrets set GEMINI_API_KEY=AIza...

# Utility script (requires .env with service role key + Anthropic key)
node scripts/merge-duplicate-findings.mjs [--dry-run]
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` — Supabase project URL (frontend)
- `VITE_SUPABASE_ANON_KEY` — public anon key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (scripts only, never frontend)
- `ANTHROPIC_API_KEY` — for `scripts/merge-duplicate-findings.mjs` only

The `GEMINI_API_KEY` used by edge functions must be set as a Supabase secret, not in `.env`.

## Architecture

**PTY Corrupción** is a Panama corruption tracking dashboard. It has two distinct layers:

### Frontend (React SPA)
- `src/App.tsx` — router + React Query provider; routes: `/`, `/hallazgos`, `/hallazgos/:id`, `/personas/:id`, `/indice`, `/estadisticas`, `/politicos`, `/apoyanos`
- `src/types/index.ts` — all TypeScript types (`Finding`, `Person`, `FindingPerson`, `PersonRelationship`, `Source`, `ScrapeLog`)
- `src/lib/supabase.ts` — single Supabase client, reads from `VITE_SUPABASE_*` env vars
- `src/contexts/AuthContext.tsx` — Supabase Auth state; provides `useAuth()` with `user`, `session`, `isLoading`, `isAuthModalOpen`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`, `openAuthModal`, `closeAuthModal`; also detects admin role
- `src/hooks/` — React Query hooks that query Supabase directly via the anon key (RLS enforces public read-only access): `useFindings`, `useFinding`, `useDashboardStats`, `useFindingComments`, `useComments`, `usePoliticians`, `useDuplicateSearch`, `useNotifications`
- `src/pages/` — `Dashboard` (stats/charts), `Findings` (filterable list), `FindingDetail`, `PersonDetail`, `CorruptionIndex` (recharts), `Estadisticas`, `Politicos` (admin editable/deletable), `Apoyanos`
- `src/components/findings/RelationshipMap.tsx` — uses `@xyflow/react` to render person relationship graphs

### Backend (Supabase)
**Database** (migrations in `supabase/migrations/`):
- `findings` — main corruption cases with severity (`critico`/`alto`/`medio`/`bajo`), category, amounts, dates
- `people` — individuals mentioned in cases
- `finding_people` — junction table linking people to findings with their role/amount/conviction status
- `person_relationships` — graph edges between people (`familiar`, `socio_comercial`, `politico`, `empleado`, `otro`)
- `sources` — news article URLs per finding
- `scrape_log` — audit log of each automated scrape run
- `finding_comments` — user comments on findings (requires auth, `user_id NOT NULL references auth.users`)
- `reactions` — emoji reactions on findings (requires auth; toggle: clicking own reaction removes it)

All tables have RLS enabled. Public tables are read-only via anon key. Comments and reactions require auth. Writes to other tables require the service role key.

**Edge Functions** (Deno, in `supabase/functions/`):
- `scrape-analyze` — the core automation pipeline, triggered daily by pg_cron:
  1. Fetches ~36 Google News RSS feeds in parallel for Panama corruption/social abuse queries
  2. Deduplicates articles by URL
  3. Calls Gemini (`gemini-2.5-flash`) to cluster articles about the same case into groups
  4. For each group, fetches full article HTML (falls back to RSS metadata if paywalled), then calls Gemini to extract structured JSON (title, summary, severity, category, people, relationships)
  5. Deduplicates against existing DB findings by URL and title prefix
  6. Inserts findings, sources, people, and relationships into Supabase
  7. Logs each run to `scrape_log`
- `backfill-source-titles` — utility that fills null `title` fields in the `sources` table by fetching HTML page titles
- `merge-duplicate` — edge function version of the duplicate-merging logic
- `corrupt-politician` — targeted scraping for a specific politician by name; uses deduplication and identity filtering to prevent duplicate DB entries; accepts `name` param in request body

**Utility Script** (`scripts/merge-duplicate-findings.mjs`):
- Uses Claude (Anthropic API, `claude-opus-4-6`) to cluster existing findings by topic and merge duplicates — picks winner by highest severity, reassigns sources/people, generates consolidated summary, deletes losers

### Key Data Flow
```
pg_cron → scrape-analyze edge function → Gemini API
                                       → Supabase DB
                                             ↑
Browser → React Query hooks → Supabase anon API → pages/components
```

### Content Domain
The app is entirely in Spanish. Severity levels, statuses, and relationship types are stored in Spanish (`critico`, `alto`, `activo`, `familiar`, etc.) and must stay consistent with the DB CHECK constraints.
