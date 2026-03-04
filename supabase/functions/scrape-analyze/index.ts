/**
 * scrape-analyze — Supabase Edge Function (Deno)
 *
 * Triggered daily by pg_cron. Searches the internet broadly for any Panamanian
 * corruption, social abuse, or government misconduct news using Google News RSS,
 * sends results to Gemini AI for structured extraction, and inserts findings into the DB.
 *
 * Deploy: supabase functions deploy scrape-analyze
 * Secret:  supabase secrets set GEMINI_API_KEY=AIza...
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI, type GenerativeModel } from 'https://esm.sh/@google/generative-ai';

// ── Search queries ────────────────────────────────────────────────────────────
// Each query is sent to both Google News and Bing News RSS, giving two independent
// views of the internet for each topic. Add queries freely — duplicates within
// a run are filtered by the in-memory processedUrls Set.

const SEARCH_QUERIES = [
  // Social / human rights (prioritized — processed first before timeout)
  'SENNIAF panama',
  'abuso menores hogares panama',
  'negligencia hospital panama',
  'CSS panama corrupcion',
  'MINSA panama irregularidades',
  'presos hacinamiento panama carcel',
  'abuso policial panama',
  'migrantes derechos humanos panama',
  'adultos mayores abandono panama',
  'hogar ninos panama muerte',

  // Financial corruption
  'corrupcion panama',
  'peculado panama',
  'soborno funcionario panama',
  'malversacion fondos publicos panama',
  'lavado dinero panama',
  'fiscalia anticorrupcion panama',
  'contraloria panama irregularidades',
  'licitacion irregular panama',
  'contratos publicos panama fraude',
  'trafico influencias panama',
  'enriquecimiento ilicito panama',
  'desfalco panama',

  // Government & political
  'funcionario imputado panama',
  'MOP panama contrato',
  'asamblea nacional panama escandalo',
  'juicio corrupcion panama',
  'ministro detenido panama',
  'alcalde panama corrupcion',
  'diputado panama investigado',

  // Environment & extractive
  'mineria ilegal panama',
  'tala ilegal panama funcionarios',
  'concesion irregular panama',

  // English queries (picks up InSight Crime, Newsroom Panama, international press)
  'Panama corruption scandal',
  'Panama government officials arrested',
  'Panama human rights violations',
  'Panama public funds misuse',
  'Panama bribery indictment',
  'Panama social services abuse',
];

// ── RSS feed URL builders + Bing redirect resolver ────────────────────────────

function googleNewsRssUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=es-419&gl=PA&ceid=PA:es-419`;
}

// ── Helper: verify a URL returns a 2xx response ───────────────────────────────

async function verifyUrl(url: string): Promise<boolean> {
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 405) {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)' },
        signal: AbortSignal.timeout(8_000),
      });
    }
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

// ── Shared content shape ──────────────────────────────────────────────────────

interface ArticleContent {
  title: string;
  description: string;
  body: string;
}

// ── RSS: parse feed and return items ─────────────────────────────────────────

interface RssItem {
  url: string;
  title: string;
  description: string;
  outlet: string;
  pubDate: string | null;
}

function extractCdata(xml: string): string {
  return xml.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRssItems(feedUrl: string): Promise<RssItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const xml = await response.text();

    const items: RssItem[] = [];
    const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemPattern.exec(xml)) !== null) {
      const chunk = itemMatch[1];

      const titleRaw = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
      const title = stripHtml(extractCdata(titleRaw));

      const linkRaw =
        chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
        chunk.match(/<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ??
        '';
      const url = extractCdata(linkRaw).trim();

      const descRaw = chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '';
      const description = stripHtml(extractCdata(descRaw));

      // <source> tag gives us the outlet name (Google News and Bing both include it)
      const outletRaw = chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? '';
      const outlet = stripHtml(extractCdata(outletRaw)) || 'Desconocido';

      const pubDate = chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? null;

      if (!url || url.startsWith('#')) continue;
      items.push({ url, title, description, outlet, pubDate });
    }

    return items.slice(0, 8);
  } catch {
    return [];
  }
}

// ── HTML: fetch full article content ─────────────────────────────────────────

async function fetchArticleContent(url: string): Promise<ArticleContent> {
  const empty: ArticleContent = { title: '', description: '', body: '' };
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return empty;
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const body = stripHtml(
      html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    );

    return { title, description, body };
  } catch {
    return empty;
  }
}

// ── Resolve content for an RSS item ──────────────────────────────────────────
// Try to fetch the full article; fall back to RSS metadata if paywalled/blocked.

async function resolveRssContent(item: RssItem): Promise<ArticleContent> {
  const fetched = await fetchArticleContent(item.url);
  if (fetched.body.length > 500) {
    return {
      title: fetched.title || item.title,
      description: fetched.description || item.description,
      body: fetched.body,
    };
  }
  // Paywalled or minimal body — use RSS metadata (still enough for Claude)
  return {
    title: item.title,
    description: item.description,
    body: `${item.title}\n\n${item.description}`,
  };
}

// ── Claude prompt ─────────────────────────────────────────────────────────────

function buildExtractionPrompt(content: ArticleContent, sourceUrl: string): string {
  const contextBlock = [
    content.title ? `TÍTULO: ${content.title}` : '',
    content.description ? `DESCRIPCIÓN: ${content.description}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `Eres un analista experto en corrupción, finanzas públicas y gobierno en Panamá. Analiza el siguiente contenido y determina si está relacionado con fondos públicos, funcionarios del gobierno, contratos, adquisiciones, o cualquier conducta irregular en el sector público.

FUENTE:
URL: ${sourceUrl}
${contextBlock}
---
${content.body.slice(0, 8000)}
---

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin markdown, sin comentarios):
{
  "is_corruption_related": boolean,
  "title": "título conciso del caso (máx 100 chars)",
  "summary": "resumen factual de 2-4 oraciones del caso",
  "severity": "critico" | "alto" | "medio" | "bajo",
  "category": "Fraude en Contratación Pública" | "Peculado / Malversación" | "Lavado de Dinero" | "Soborno / Cohecho" | "Tráfico de Influencias" | "Captura del Estado" | "Abuso en Emergencias" | "Corrupción en Seguridad" | "Negligencia y Abuso Institucional" | "Violación de Derechos Humanos",
  "amount_usd": number | null,
  "date_occurred": "YYYY-MM-DD" | null,
  "people": [
    {
      "name": "Nombre Completo",
      "role": "cargo o rol",
      "role_in_case": "rol en el caso (acusado, condenado, investigado, testigo, implicado)",
      "amount_usd": number | null,
      "is_convicted": boolean,
      "is_public_figure": boolean
    }
  ],
  "relationships": [
    {
      "person_a": "Nombre A",
      "person_b": "Nombre B",
      "relationship": "familiar" | "socio_comercial" | "politico" | "empleado" | "otro",
      "description": "breve descripción"
    }
  ]
}

Criterios para is_corruption_related = true:
- Cualquier uso indebido, irregular o cuestionable de fondos públicos
- Contratos públicos, licitaciones, adquisiciones o adjudicaciones irregulares
- Funcionarios públicos implicados en sobornos, peculado o conflictos de interés
- Relaciones entre funcionarios y empresas privadas que pudieran ser irregulares
- Informes de auditoría o contraloría que detecten irregularidades
- Investigaciones penales o administrativas a funcionarios públicos
- Negligencia, abuso, maltrato o abandono de personas bajo custodia o protección del Estado
  (instituciones como SENNIAF, hospitales públicos, cárceles, hogares de menores)
- Violaciones de derechos humanos cometidas o toleradas por entidades gubernamentales
- Mal manejo de recursos públicos destinados a poblaciones vulnerables (niños, adultos mayores,
  personas con discapacidad, migrantes)
- Omisión deliberada de deberes por parte de funcionarios que resulte en daño a personas

Usa "Negligencia y Abuso Institucional" cuando la falla sea operativa/de cuidado (ej. muertes en hogares del SENNIAF, hacinamiento carcelario, negligencia médica estatal).
Usa "Violación de Derechos Humanos" cuando haya privación de libertad arbitraria, tortura, desaparición, discriminación sistemática u otras violaciones graves de derechos fundamentales por el Estado.

Marca is_corruption_related = false SOLO si el contenido no tiene ninguna relación con:
- gobierno, fondos públicos, funcionarios, contratos, conducta oficial, o bienestar de personas bajo tutela estatal.

Criterios de severidad:
- crítico: >$1M + múltiples funcionarios + cargos penales confirmados
- alto: corrupción confirmada, montos significativos o funcionarios de alto nivel
- medio: bajo investigación formal, evidencia creíble pero sin condena
- bajo: irregularidades administrativas menores, alertas tempranas

Extrae TODAS las personas mencionadas y sus relaciones aunque el documento no sea explícitamente sobre corrupción — las conexiones entre funcionarios y empresas son valiosas.`;
}

// ── Helper: deduplicate against existing findings ─────────────────────────────

async function isDuplicate(
  supabase: ReturnType<typeof createClient>,
  title: string,
  urls: string[]
): Promise<boolean> {
  const { data: byUrl } = await supabase
    .from('sources')
    .select('id')
    .in('url', urls)
    .limit(1);
  if (byUrl && byUrl.length > 0) return true;

  const titleStart = title.slice(0, 60);
  const { data: byTitle } = await supabase
    .from('findings')
    .select('id')
    .ilike('title', `${titleStart}%`)
    .limit(1);
  return !!(byTitle && byTitle.length > 0);
}

// ── Cluster RSS items into topic groups via Gemini ───────────────────────────
// One Gemini call groups all items so articles about the same case produce
// one consolidated finding instead of many duplicates.

async function clusterItemsIntoGroups(
  model: GenerativeModel,
  items: RssItem[]
): Promise<RssItem[][]> {
  if (items.length <= 1) return items.map(item => [item]);

  const itemList = items
    .map((item, i) => `[${i}] ${item.title}${item.description ? ' — ' + item.description.slice(0, 120) : ''}`)
    .join('\n');

  try {
    const text = await callGemini(model, `Agrupa los siguientes artículos de noticias por caso/evento específico. Artículos sobre el mismo escándalo, persona imputada, contrato o incidente van juntos. Artículos sobre distintos casos van separados aunque compartan el mismo tema general.

${itemList}

Responde ÚNICAMENTE con JSON válido (sin markdown ni comentarios):
{"groups":[[0,3,7],[1,2],[4],[5,6],...]}

Todo índice del 0 al ${items.length - 1} debe aparecer exactamente una vez.`);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object in clustering response');
    const { groups } = JSON.parse(jsonMatch[0]) as { groups: number[][] };

    const seen = new Set<number>();
    const result: RssItem[][] = [];
    for (const group of groups) {
      const valid = group.filter(i => Number.isInteger(i) && i >= 0 && i < items.length && !seen.has(i));
      valid.forEach(i => seen.add(i));
      if (valid.length > 0) result.push(valid.map(i => items[i]));
    }
    // Append any items Gemini missed
    for (let i = 0; i < items.length; i++) {
      if (!seen.has(i)) result.push([items[i]]);
    }

    const grouped = result.filter(g => g.length > 1).length;
    console.log(`Clustered ${items.length} articles into ${result.length} groups (${grouped} multi-article groups)`);
    return result;
  } catch (e) {
    console.warn('Gemini clustering failed, treating each item independently:', e);
    return items.map(item => [item]);
  }
}

// ── Resolve and merge content for a group of items ────────────────────────────

async function resolveGroupContent(group: RssItem[]): Promise<ArticleContent> {
  const contents = await Promise.all(group.map(item => resolveRssContent(item)));

  if (group.length === 1) return contents[0];

  const title = contents.find(c => c.title)?.title || group[0].title;
  const description = contents.find(c => c.description)?.description || group[0].description;
  const body = contents
    .map((c, i) => `=== FUENTE ${i + 1} (${group[i].outlet}) ===\n${c.body}`)
    .join('\n\n')
    .slice(0, 10000);

  return { title, description, body };
}

// ── Helper: upsert person ─────────────────────────────────────────────────────

async function upsertPerson(
  supabase: ReturnType<typeof createClient>,
  name: string,
  role: string | null,
  isPublicFigure: boolean
): Promise<string> {
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .ilike('name', name)
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const { data, error } = await supabase
    .from('people')
    .insert({ name, role, is_public_figure: isPublicFigure })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to insert person: ${error.message}`);
  return data.id;
}

// ── Gemini call with one retry on 429 ────────────────────────────────────────

async function callGemini(model: GenerativeModel, prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429 || String(err?.message).includes('429')) {
      console.warn('Rate limited — retrying in 6s');
      await new Promise(r => setTimeout(r, 6000));
      const result = await model.generateContent(prompt);
      return result.response.text();
    }
    throw e;
  }
}

// ── Process a group of articles through Claude and persist to DB ───────────────
// All items in the group are about the same case; one finding is created with
// one source row per verified URL.

async function processArticle(
  supabase: ReturnType<typeof createClient>,
  model: GenerativeModel,
  items: RssItem[],
  content: ArticleContent
): Promise<boolean> {
  const primaryItem = items[0];

  let extracted: Record<string, unknown>;
  try {
    const rawText = await callGemini(model, buildExtractionPrompt(content, primaryItem.url));
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object in Gemini response');
    extracted = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`  Gemini/parse error for ${primaryItem.url}:`, e);
    return false;
  }

  if (!extracted.is_corruption_related) return false;
  if (!extracted.title || !extracted.summary) return false;

  const dup = await isDuplicate(supabase, String(extracted.title), items.map(i => i.url));
  if (dup) {
    console.log(`  Duplicate, skipping: ${extracted.title}`);
    return false;
  }

  // Verify all URLs in parallel; use first verified as the finding's primary URL
  const verifiedFlags = await Promise.all(items.map(i => verifyUrl(i.url)));
  const primaryVerifiedUrl = items.find((_, idx) => verifiedFlags[idx])?.url ?? null;

  const { data: finding, error: findingError } = await supabase
    .from('findings')
    .insert({
      title: String(extracted.title),
      summary: String(extracted.summary),
      severity: extracted.severity ?? 'bajo',
      category: extracted.category ?? 'Fraude en Contratación Pública',
      amount_usd: extracted.amount_usd ?? null,
      date_occurred: extracted.date_occurred ?? null,
      date_reported: new Date().toISOString().split('T')[0],
      source_url: primaryVerifiedUrl,
    })
    .select('id')
    .single();

  if (findingError) {
    console.error(`  DB error inserting finding:`, findingError);
    return false;
  }

  const findingId = finding.id;

  // Insert one source row per verified URL in the group
  for (let idx = 0; idx < items.length; idx++) {
    if (!verifiedFlags[idx]) continue;
    const groupItem = items[idx];
    const itemPubDate = groupItem.pubDate ? (() => {
      try { return new Date(groupItem.pubDate!).toISOString().split('T')[0]; } catch { return null; }
    })() : null;
    await supabase.from('sources').insert({
      finding_id: findingId,
      url: groupItem.url,
      title: content.title || groupItem.title || null,
      outlet: groupItem.outlet,
      published_at: itemPubDate ?? extracted.date_occurred ?? null,
    });
  }

  const people = (extracted.people as Array<{
    name: string;
    role?: string;
    role_in_case?: string;
    amount_usd?: number;
    is_convicted?: boolean;
    is_public_figure?: boolean;
  }>) ?? [];
  const personIdMap: Record<string, string> = {};

  for (const p of people) {
    if (!p.name) continue;
    try {
      const personId = await upsertPerson(supabase, p.name, p.role ?? null, p.is_public_figure ?? false);
      personIdMap[p.name] = personId;
      await supabase.from('finding_people').upsert(
        {
          finding_id: findingId,
          person_id: personId,
          role_in_case: p.role_in_case ?? null,
          amount_usd: p.amount_usd ?? null,
          is_convicted: p.is_convicted ?? false,
        },
        { onConflict: 'finding_id,person_id' }
      );
    } catch (e) {
      console.error(`  Error inserting person ${p.name}:`, e);
    }
  }

  const rels = (extracted.relationships as Array<{
    person_a: string;
    person_b: string;
    relationship: string;
    description?: string;
  }>) ?? [];

  for (const rel of rels) {
    const aId = personIdMap[rel.person_a];
    const bId = personIdMap[rel.person_b];
    if (!aId || !bId) continue;
    await supabase
      .from('person_relationships')
      .upsert(
        { person_a_id: aId, person_b_id: bId, relationship: rel.relationship, description: rel.description ?? null },
        { onConflict: 'person_a_id,person_b_id' }
      )
      .then(() => {});
  }

  console.log(`  ✓ Created finding: ${extracted.title}`);
  return true;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not set. Run: supabase secrets set GEMINI_API_KEY=AIza...' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });

  const startTime = Date.now();
  let articlesFound = 0;
  let findingsCreated = 0;
  let lastError: string | null = null;

  try {
    // Step 1: fetch all Google News RSS feeds in parallel (~36 requests at once, ~10s total)
    const allFeeds = SEARCH_QUERIES.map(q => ({
      feedUrl: googleNewsRssUrl(q), label: `google:${q}`,
    }));

    console.log(`Fetching ${allFeeds.length} RSS feeds in parallel…`);
    const feedResults = await Promise.all(
      allFeeds.map(f => fetchRssItems(f.feedUrl))
    );
    console.log(`RSS fetch complete. Deduplicating…`);

    // Step 2: flatten + deduplicate by URL
    const processedUrls = new Set<string>();
    const queue: RssItem[] = [];
    for (const items of feedResults) {
      for (const item of items) {
        if (!item.url || processedUrls.has(item.url)) continue;
        processedUrls.add(item.url);
        queue.push(item);
      }
    }
    console.log(`${queue.length} unique articles to process`);

    // Step 3: cluster items into topic groups (one Claude call)
    const groups = await clusterItemsIntoGroups(model, queue);

    // Step 4: process groups in parallel batches, respecting a time budget
    const BATCH_SIZE = 6;
    const TIME_BUDGET_MS = 80_000;

    for (let i = 0; i < groups.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`Time budget reached after ${i} of ${groups.length} groups — stopping early`);
        break;
      }
      const batch = groups.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (group) => {
        articlesFound += group.length;
        console.log(`  Processing group (${group.length} article${group.length > 1 ? 's' : ''}): ${group[0].title || group[0].url}`);
        const content = await resolveGroupContent(group);
        return processArticle(supabase, model, group, content);
      }));
      findingsCreated += results.filter(Boolean).length;
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error('Fatal error:', lastError);
  }

  const duration = Date.now() - startTime;

  await supabase.from('scrape_log').insert({
    sources_checked: SEARCH_QUERIES.length,
    articles_found: articlesFound,
    findings_created: findingsCreated,
    status: lastError ? 'error' : findingsCreated > 0 ? 'success' : 'partial',
    error_message: lastError,
    duration_ms: duration,
  });

  return new Response(
    JSON.stringify({
      success: !lastError,
      queries_checked: SEARCH_QUERIES.length,
      articles_found: articlesFound,
      findings_created: findingsCreated,
      duration_ms: duration,
      error: lastError,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
