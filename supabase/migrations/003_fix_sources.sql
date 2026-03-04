-- ============================================================
-- FIX: Update broken seed source URLs to stable, verified links
-- ============================================================

-- ── Fix sources table entries ─────────────────────────────────────────────────

-- Odebrecht: fix malformed DOJ URL ("andagree" → "and-agree", doj.gov → justice.gov)
UPDATE sources
SET url = 'https://www.justice.gov/opa/pr/odebrecht-and-braskem-plead-guilty-and-agree-pay-least-35-billion-global-penalties'
WHERE url = 'https://www.doj.gov/opa/pr/odebrecht-and-braskem-plead-guilty-andagree-pay-least-35-billion-global-penalties';

-- Odebrecht: La Prensa article URL (slug-based, likely 404)
UPDATE sources
SET url = 'https://www.justice.gov/opa/pr/odebrecht-and-braskem-plead-guilty-and-agree-pay-least-35-billion-global-penalties',
    outlet = 'U.S. Department of Justice',
    title = 'Odebrecht and Braskem Plead Guilty and Agree to Pay at Least $3.5 Billion in Global Penalties'
WHERE url = 'https://www.prensa.com/judiciales/hijos-martinelli-odebrecht/';

-- Panama Papers: TVN-2 slug URL → ICIJ stable page
UPDATE sources
SET url = 'https://www.icij.org/investigations/panama-papers/',
    outlet = 'ICIJ',
    title = 'Panama Papers'
WHERE url = 'https://www.tvn-2.com/nacionales/judiciales/panama-papers-absueltos/';

-- Blue Apple: La Prensa slug URL → Ministerio Público noticias
UPDATE sources
SET url = 'https://ministeriopublico.gob.pa/noticias/',
    outlet = 'Ministerio Público',
    title = 'Noticias - Ministerio Público de Panamá'
WHERE url = 'https://www.prensa.com/judiciales/blue-apple-condenan-federico-suarez/';

-- Martinelli: La Prensa slug URL → InSight Crime Panama page
UPDATE sources
SET url = 'https://insightcrime.org/panama-organized-crime-news/panama/',
    outlet = 'InSight Crime',
    title = 'Panama Organized Crime News - InSight Crime'
WHERE url = 'https://www.prensa.com/judiciales/martinelli-condenado-pinchazos/';

-- PDVSA: broken InSight Crime analysis slug → InSight Crime Panama hub
UPDATE sources
SET url = 'https://insightcrime.org/panama-organized-crime-news/'
WHERE url = 'https://insightcrime.org/news/analysis/pdvsa-panama-money-laundering/';

-- COVID: no stable URL exists — delete this source entry
DELETE FROM sources
WHERE url = 'https://www.tvn-2.com/nacionales/salud/compras-irregulares-covid/';

-- ── Fix findings.source_url entries ──────────────────────────────────────────

-- Martinelli peculado (b6): broken La Prensa URL
UPDATE findings
SET source_url = 'https://insightcrime.org/panama-organized-crime-news/panama/'
WHERE source_url = 'https://www.prensa.com/judiciales/caso-martinelli/';

-- PDVSA (b7): broken InSight Crime analysis slug
UPDATE findings
SET source_url = 'https://insightcrime.org/panama-organized-crime-news/'
WHERE source_url = 'https://insightcrime.org/news/analysis/pdvsa-panama-money-laundering/';

-- COVID (b8): broken TVN-2 URL — null out since no stable replacement
UPDATE findings
SET source_url = NULL
WHERE source_url = 'https://www.tvn-2.com/nacionales/salud/compras-covid-panama/';
