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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Search queries ────────────────────────────────────────────────────────────
// Each query is sent to both Google News and Bing News RSS, giving two independent
// views of the internet for each topic. Add queries freely — duplicates within
// a run are filtered by the in-memory processedUrls Set.

const SEARCH_QUERIES = [
  // Social / human rights (prioritized — processed first before timeout)
  "SENNIAF panama",
  "abuso menores hogares panama",
  "negligencia hospital panama",
  "CSS panama corrupcion",
  "MINSA panama irregularidades",
  "presos hacinamiento panama carcel",
  "abuso policial panama",
  "migrantes derechos humanos panama",
  "adultos mayores abandono panama",
  "hogar ninos panama muerte",
  "protestas en panama",
  "muerte de manifestantes panama",
  "abuso policial panama",
  "violacion de derechos humanos panama",
  "MEDUCA panama corrupcion",
  "racismo panama",
  "discriminacion panama",
  "homofobia panama",
  "transfobia panama",
  "discriminacion racial panama",
  "discriminacion sexual panama",
  "discriminacion de género panama",
  "discriminacion de orientación sexual panama",
  "discriminacion de identidad de género panama",
  "discriminacion de expresión panama",
  "discriminacion de religión panama",

  // Financial corruption
  "corrupcion panama",
  "peculado panama",
  "soborno funcionario panama",
  "malversacion fondos publicos panama",
  "lavado dinero panama",
  "fiscalia anticorrupcion panama",
  "contraloria panama irregularidades",
  "licitacion irregular panama",
  "contratos publicos panama fraude",
  "trafico influencias panama",
  "enriquecimiento ilicito panama",
  "desfalco panama",
  "fraude en contratacion panama",
  "electricidad panama fraude",
  "electricidad panama soborno",
  "electricidad panama malversacion",
  "electricidad panama lavado de dinero",
  "electricidad panama fraude en contratacion",
  "electricidad panama soborno",
  "electricidad panama malversacion",
  "electricidad panama lavado de dinero",
  "telefonia panama fraude",
  "telefonia panama soborno",
  "telefonia panama malversacion",
  "telefonia panama lavado de dinero",
  "telefonia panama fraude en contratacion",
  "telefonia panama soborno",
  "telefonia panama malversacion",
  "telefonia panama lavado de dinero",
  "mas movil panama estafa",
  "tigo panama estafa",
  "costo de vida",
  "precio de la gasolina",
  "precio de vivienda",

  // Government & political
  "funcionario imputado panama",
  "MOP panama contrato",
  "asamblea nacional panama escandalo",
  "juicio corrupcion panama",
  "ministro detenido panama",
  "alcalde panama corrupcion",
  "diputado panama investigado",
  "presidente panama corrupcion",
  "vicepresidente panama corrupcion",
  "ministro panama corrupcion",
  "alcalde panama corrupcion",
  "expresidente panama corrupcion",
  "exvicepresidente panama corrupcion",
  "exministro panama corrupcion",
  "exalcalde panama corrupcion",
  "exdiputado panama corrupcion",
  "exfuncionario panama corrupcion",
  "expresidente panama corrupcion",
  "exvicepresidente panama corrupcion",
  "exministro panama corrupcion",
  "exalcalde panama corrupcion",

  // Environment & extractive
  "mineria ilegal panama",
  "tala ilegal panama funcionarios",
  "concesion irregular panama",
  "corrupcion canal de panama",

  // English queries (picks up InSight Crime, Newsroom Panama, international press)
  "Panama corruption scandal",
  "Panama government officials arrested",
  "Panama human rights violations",
  "Panama public funds misuse",
  "Panama bribery indictment",
  "Panama social services abuse",
  "Panama corruption in construction",
  "Panama corruption in public procurement",
  "Panama corruption in public services",
  "Panama corruption in public transport",
  "Panama corruption in public health",
  "Panama corruption in public education",
  "Panama corruption in public security",
  "Panama corruption in public environment",
  "Panama corruption in public justice",
  "Panama corruption in public finance",
  "Panama corruption in public administration",
  "Panama corruption in public international relations",
  "Panama corruption in public international cooperation",
  "Panama corruption in public international trade",
  "Panama corruption in public international law",
  "Panama corruption in public international organization",
  "Panama corruption in public international treaty",
  "Panama corruption in public international agreement",
  "Panama corruption in public international convention",
  "Panama corruption in public international protocol",
  "Panama corruption in public international resolution",
  "Panama corruption in public international declaration",
  "Panama corruption in public international resolution",
  "Panama corruption in public international declaration",
  "Panama corruption in public international resolution",
  "Panama corruption in public international declaration",
];

// ── Financial / money-corruption categories ───────────────────────────────────
// Used to guarantee at least 2 money-related findings per run.

const MONEY_CATEGORIES = new Set([
  "Fraude en Contratación Pública",
  "Peculado / Malversación",
  "Lavado de Dinero",
  "Soborno / Cohecho",
  "Tráfico de Influencias",
  "Captura del Estado",
]);

// Targeted queries run as a supplemental pass when the main scrape produces
// fewer than 2 money-related findings. These focus on financial corruption only.
const MONEY_QUERIES = [
  "peculado panama",
  "soborno funcionario panama",
  "malversacion fondos publicos panama",
  "lavado dinero panama",
  "fiscalia anticorrupcion panama",
  "contraloria panama irregularidades",
  "licitacion irregular panama",
  "contratos publicos panama fraude",
  "enriquecimiento ilicito panama",
  "desfalco panama",
  "trafico influencias panama",
  "Panama bribery indictment",
  "Panama public funds misuse",
  "Panama money laundering",
  "Panama corruption fraud",
];

// ── RSS feed URL builders + Bing redirect resolver ────────────────────────────

// timeAppend is appended to the query string and supports Google News operators
// such as "when:30d" (recent) or "after:2023-01-01 before:2024-01-01" (archive).
function googleNewsRssUrl(query: string, timeAppend = ""): string {
  const q = timeAppend ? `${query} ${timeAppend}` : query;
  const encoded = encodeURIComponent(q);
  return `https://news.google.com/rss/search?q=${encoded}&hl=es-419&gl=PA&ceid=PA:es-419`;
}

// Compute a dynamic archive date range: 2 years ago → 1 year ago (Panama UTC-5).
// Refreshes every run so the window keeps advancing.
function archiveDateFilter(): string {
  const nowPanamaMs = Date.now() - 5 * 60 * 60 * 1000;
  const now = new Date(nowPanamaMs);
  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(now.getFullYear() - 3);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  // Fixed start of 2000 so the window covers major historical cases:
  // Torrijos (2004–2009), Panama Papers (2016), Martinelli (2014+), etc.
  return `after:2000-01-01 before:${fmt(threeYearsAgo)}`;
}

// ── Helper: verify a URL returns a 2xx response ───────────────────────────────

async function verifyUrl(url: string): Promise<boolean> {
  try {
    let response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)",
      },
      signal: AbortSignal.timeout(4_000),
    });
    if (response.status === 405) {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)",
        },
        signal: AbortSignal.timeout(4_000),
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
  return xml.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchRssItems(feedUrl: string): Promise<RssItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
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

      const titleRaw =
        chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const title = stripHtml(extractCdata(titleRaw));

      const linkRaw =
        chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
        chunk.match(
          /<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/i,
        )?.[1] ??
        "";
      const url = extractCdata(linkRaw).trim();

      const descRaw =
        chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "";
      const description = stripHtml(extractCdata(descRaw));

      // <source> tag gives us the outlet name (Google News and Bing both include it)
      const outletRaw =
        chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";
      const outlet = stripHtml(extractCdata(outletRaw)) || "Desconocido";

      const pubDate =
        chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ??
        null;

      if (!url || url.startsWith("#")) continue;
      items.push({ url, title, description, outlet, pubDate });
    }

    return items.slice(0, 5);
  } catch {
    return [];
  }
}

// ── HTML: fetch full article content ─────────────────────────────────────────

async function fetchArticleContent(url: string): Promise<ArticleContent> {
  const empty: ArticleContent = { title: "", description: "", body: "" };
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return empty;
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const descMatch =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
      );
    const description = descMatch ? descMatch[1].trim() : "";

    const body = stripHtml(
      html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " "),
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

function buildExtractionPrompt(
  content: ArticleContent,
  sourceUrl: string,
): string {
  const contextBlock = [
    content.title ? `TÍTULO: ${content.title}` : "",
    content.description ? `DESCRIPCIÓN: ${content.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `Eres un analista experto en corrupción, finanzas públicas y gobierno en Panamá. Analiza el siguiente contenido y determina si está relacionado con fondos públicos, funcionarios del gobierno, contratos, adquisiciones, o cualquier conducta irregular en el sector público o privado en Panamá.

FUENTE:
URL: ${sourceUrl}
${contextBlock}
---
${content.body.slice(0, 5000)}
---

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin markdown, sin comentarios):
{
  "is_corruption_related": boolean,
  "title": "título conciso del caso (máx 100 chars)",
  "summary": "Redacta la nota periodística completa como si fueras el reportero. Incluye todos los hechos, nombres, cargos, montos, fechas, instituciones, declaraciones y consecuencias mencionadas en el contenido. Escribe en tercera persona, estilo periodístico directo, sin introducir la nota con frases como 'Este artículo trata sobre…' o 'La noticia describe…'. Mínimo 2 párrafos.",
  "severity": "critico" | "alto" | "medio" | "bajo",
  "category": "Fraude en Contratación Pública" | "Peculado / Malversación" | "Lavado de Dinero" | "Soborno / Cohecho" | "Tráfico de Influencias" | "Captura del Estado" | "Abuso en Emergencias" | "Corrupción en Seguridad" | "Negligencia y Abuso Institucional" | "Violación de Derechos Humanos",
  "amount_usd": number | null,
  "date_occurred": "YYYY-MM-DD" | null,
  "people": [
    {
      "name": "Nombre Completo",
      "role": "cargo o rol",
      "role_in_case": "rol en el caso (acusado, condenado, investigado, testigo, implicado, victima)",
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

// ── Bulk-load known source URLs from the last 60 days ─────────────────────────
// Called once per run before any AI work so we can skip articles that are
// already stored in the sources table without touching Gemini at all.

async function loadKnownUrls(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("sources")
    .select("url")
    .gte("created_at", cutoff);
  return new Set(data?.map((s: { url: string }) => s.url) ?? []);
}

// ── Helper: deduplicate against existing findings ─────────────────────────────

async function isDuplicate(
  supabase: ReturnType<typeof createClient>,
  title: string,
  urls: string[],
): Promise<boolean> {
  const { data: byUrl } = await supabase
    .from("sources")
    .select("id")
    .in("url", urls)
    .limit(1);
  if (byUrl && byUrl.length > 0) return true;

  const titleStart = title.slice(0, 60);
  const { data: byTitle } = await supabase
    .from("findings")
    .select("id")
    .ilike("title", `${titleStart}%`)
    .limit(1);
  return !!(byTitle && byTitle.length > 0);
}

// ── Cluster RSS items into topic groups via Gemini ───────────────────────────
// One Gemini call groups all items so articles about the same case produce
// one consolidated finding instead of many duplicates.

async function clusterItemsIntoGroups(
  apiKey: string,
  items: RssItem[],
): Promise<RssItem[][]> {
  if (items.length <= 1) return items.map((item) => [item]);

  const itemList = items
    .map(
      (item, i) =>
        `[${i}] ${item.title}${item.description ? " — " + item.description.slice(0, 120) : ""}`,
    )
    .join("\n");

  try {
    const clusterPrompt = `Agrupa los siguientes artículos de noticias por caso/evento específico. Artículos sobre el mismo escándalo, persona imputada, contrato o incidente van juntos. Artículos que involucren a las mismas personas o casos van juntos.

${itemList}

Responde ÚNICAMENTE con JSON válido (sin markdown ni comentarios):
{"groups":[[0,3,7],[1,2],[4],[5,6],...]}

Todo índice del 0 al ${items.length - 1} debe aparecer exactamente una vez.`;
    const text = await callGemini(apiKey, clusterPrompt, 30_000);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object in clustering response");
    const { groups } = JSON.parse(jsonMatch[0]) as { groups: number[][] };

    const seen = new Set<number>();
    const result: RssItem[][] = [];
    for (const group of groups) {
      const valid = group.filter(
        (i) =>
          Number.isInteger(i) && i >= 0 && i < items.length && !seen.has(i),
      );
      valid.forEach((i) => seen.add(i));
      if (valid.length > 0) result.push(valid.map((i) => items[i]));
    }
    // Append any items Gemini missed
    for (let i = 0; i < items.length; i++) {
      if (!seen.has(i)) result.push([items[i]]);
    }

    const grouped = result.filter((g) => g.length > 1).length;
    console.log(
      `Clustered ${items.length} articles into ${result.length} groups (${grouped} multi-article groups)`,
    );
    return result;
  } catch (e) {
    console.warn(
      "Gemini clustering failed, treating each item independently:",
      e,
    );
    return items.map((item) => [item]);
  }
}

// ── Resolve and merge content for a group of items ────────────────────────────
// Uses RSS metadata only (title + description) — avoids slow/blocked article
// fetches and keeps Gemini prompts short so each extraction call is ~5-10s
// instead of ~25-35s, allowing 3x more groups per run.

function resolveGroupContent(group: RssItem[]): ArticleContent {
  const title = group[0].title;
  const description = group.find((i) => i.description)?.description ?? "";
  const body = group
    .map(
      (item) =>
        `${item.outlet}: ${item.title}${item.description ? "\n" + item.description : ""}`,
    )
    .join("\n\n")
    .slice(0, 3000);
  return { title, description, body };
}

// ── Helper: upsert person ─────────────────────────────────────────────────────

async function upsertPerson(
  supabase: ReturnType<typeof createClient>,
  name: string,
  role: string | null,
  isPublicFigure: boolean,
): Promise<string> {
  const { data: existing } = await supabase
    .from("people")
    .select("id")
    .ilike("name", name)
    .limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const { data, error } = await supabase
    .from("people")
    .insert({ name, role, is_public_figure: isPublicFigure })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to insert person: ${error.message}`);
  return data.id;
}

// ── Panama timezone helpers ───────────────────────────────────────────────────
// Panama is UTC-5 and does not observe DST.

function todayInPanama(): string {
  const panamaMs = Date.now() - 5 * 60 * 60 * 1000;
  return new Date(panamaMs).toISOString().split("T")[0];
}

function pubDateToPanamaDate(pubDate: string): string | null {
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return null;
    const panamaMs = d.getTime() - 5 * 60 * 60 * 1000;
    return new Date(panamaMs).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// ── Gemini REST call with one retry on 429 ───────────────────────────────────

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function callGemini(
  apiKey: string,
  prompt: string,
  timeoutMs = 55_000,
): Promise<string> {
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  const headers = { "Content-Type": "application/json" };

  let res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 429) {
    console.warn("Rate limited — retrying in 6s");
    await new Promise((r) => setTimeout(r, 6000));
    res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  if (!res.ok)
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text as string;
}

// ── Process a group of articles through Claude and persist to DB ───────────────
// All items in the group are about the same case; one finding is created with
// one source row per verified URL.

// Returns the finding's category string on success, or false if skipped/failed.
async function processArticle(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  items: RssItem[],
  content: ArticleContent,
): Promise<string | false> {
  const primaryItem = items[0];

  let extracted: Record<string, unknown>;
  try {
    const rawText = await callGemini(
      apiKey,
      buildExtractionPrompt(content, primaryItem.url),
    );
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object in Gemini response");
    extracted = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`  Gemini/parse error for ${primaryItem.url}:`, e);
    return false;
  }

  if (!extracted.is_corruption_related) return false;
  if (!extracted.title || !extracted.summary) return false;

  const dup = await isDuplicate(
    supabase,
    String(extracted.title),
    items.map((i) => i.url),
  );
  if (dup) {
    console.log(`  Duplicate, skipping: ${extracted.title}`);
    return false;
  }

  // Verify all URLs in parallel; use first verified as the finding's primary URL
  const verifiedFlags = await Promise.all(items.map((i) => verifyUrl(i.url)));
  const primaryVerifiedUrl =
    items.find((_, idx) => verifiedFlags[idx])?.url ?? null;

  // Derive date_reported from the most recent article pubDate (Panama time, UTC-5).
  // Fall back to date_occurred extracted by Gemini from the article body.
  // Cap at today (Panama) only to prevent future-dated UTC timestamps.
  const todayPanama = todayInPanama();
  const groupPanamaDates = items
    .map((i) => (i.pubDate ? pubDateToPanamaDate(i.pubDate) : null))
    .filter((d): d is string => d !== null && d <= todayPanama);
  const dateReported =
    groupPanamaDates.length > 0
      ? groupPanamaDates.sort().at(-1)!
      : ((extracted.date_occurred as string | null) ?? todayPanama);

  const { data: finding, error: findingError } = await supabase
    .from("findings")
    .insert({
      title: String(extracted.title),
      summary: String(extracted.summary),
      severity: extracted.severity ?? "bajo",
      category: extracted.category ?? "Fraude en Contratación Pública",
      amount_usd: extracted.amount_usd ?? null,
      date_occurred: extracted.date_occurred ?? null,
      date_reported: dateReported,
      source_url: primaryVerifiedUrl,
    })
    .select("id")
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
    const itemPubDate = groupItem.pubDate
      ? (() => {
          try {
            return new Date(groupItem.pubDate!).toISOString().split("T")[0];
          } catch {
            return null;
          }
        })()
      : null;
    await supabase.from("sources").insert({
      finding_id: findingId,
      url: groupItem.url,
      title: content.title || groupItem.title || null,
      outlet: groupItem.outlet,
      published_at: itemPubDate ?? extracted.date_occurred ?? null,
    });
  }

  const people =
    (extracted.people as Array<{
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
      const personId = await upsertPerson(
        supabase,
        p.name,
        p.role ?? null,
        p.is_public_figure ?? false,
      );
      personIdMap[p.name] = personId;
      await supabase.from("finding_people").upsert(
        {
          finding_id: findingId,
          person_id: personId,
          role_in_case: p.role_in_case ?? null,
          amount_usd: p.amount_usd ?? null,
          is_convicted: p.is_convicted ?? false,
        },
        { onConflict: "finding_id,person_id" },
      );
    } catch (e) {
      console.error(`  Error inserting person ${p.name}:`, e);
    }
  }

  const rels =
    (extracted.relationships as Array<{
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
      .from("person_relationships")
      .upsert(
        {
          person_a_id: aId,
          person_b_id: bId,
          relationship: rel.relationship,
          description: rel.description ?? null,
        },
        { onConflict: "person_a_id,person_b_id" },
      )
      .then(() => {});
  }

  const category = String(
    extracted.category ?? "Fraude en Contratación Pública",
  );
  console.log(`  ✓ Created finding [${category}]: ${extracted.title}`);
  return category;
}

// ── Pre-screen raw articles for relevance by title ────────────────────────────
// Runs BEFORE clustering so the clustering call only receives relevant articles.
// One cheap Gemini call (titles only, no body) filters out ~70-80% of irrelevant
// articles (sports, weather, entertainment, etc.), keeping the clustering prompt
// small enough to avoid timeouts.

async function preScreenArticles(
  apiKey: string,
  items: RssItem[],
): Promise<RssItem[]> {
  if (items.length === 0) return [];

  const itemList = items
    .map(
      (item, i) =>
        `[${i}] ${item.title}${item.description ? " — " + item.description.slice(0, 80) : ""}`,
    )
    .join("\n");

  try {
    const screenPrompt = `Eres un filtro de relevancia rápido. Analiza los siguientes titulares de artículos de noticias panameñas y devuelve SOLO los índices de artículos que probablemente cubran alguno de estos temas:
- Corrupción, peculado, soborno, fraude, lavado de dinero
- Contratos o licitaciones irregulares, uso indebido de fondos públicos
- Funcionarios imputados, detenidos o investigados
- Abuso, negligencia o maltrato en instituciones del Estado (SENNIAF, hospitales, cárceles)
- Violaciones de derechos humanos por entidades gubernamentales
- Irregularidades en contrataciones, concesiones o adquisiciones públicas

${itemList}

Responde ÚNICAMENTE con JSON válido (sin markdown): {"relevant":[0,5,12,...]}
Excluye deportes, entretenimiento, accidentes de tráfico sin funcionarios implicados, clima, o eventos puramente privados.`;
    const text = await callGemini(apiKey, screenPrompt, 30_000);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in pre-screen response");
    const { relevant } = JSON.parse(jsonMatch[0]) as { relevant: number[] };
    const valid = relevant.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < items.length,
    );
    console.log(
      `Pre-screened: ${valid.length} of ${items.length} articles are relevant (${Math.round((valid.length / items.length) * 100)}%)`,
    );
    return valid.map((i) => items[i]);
  } catch (e) {
    console.warn("Pre-screening failed, processing all articles:", e);
    return items;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

  if (!geminiKey) {
    return new Response(
      JSON.stringify({
        error:
          "GEMINI_API_KEY not set. Run: supabase secrets set GEMINI_API_KEY=AIza...",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const startTime = Date.now();
  let articlesFound = 0;
  let findingsCreated = 0;
  let moneyFindingsCreated = 0;
  let lastError: string | null = null;

  try {
    // Step 1: fetch all Google News RSS feeds in parallel.
    // Half of the queries use a 30-day recency filter; the other half use an
    // archive window (2 years ago → 1 year ago) so each run covers both fresh
    // news AND older cases that haven't been ingested yet.
    const archiveFilter = archiveDateFilter();
    const midpoint = Math.ceil(SEARCH_QUERIES.length / 2);
    const allFeeds = SEARCH_QUERIES.map((q, i) => {
      const timeAppend = i < midpoint ? "when:30d" : archiveFilter;
      return {
        feedUrl: googleNewsRssUrl(q, timeAppend),
        label: `google:${q}:${i < midpoint ? "recent" : "archive"}`,
      };
    });

    console.log(
      `Fetching ${allFeeds.length} RSS feeds in parallel (${midpoint} recent + ${allFeeds.length - midpoint} archive)…`,
    );
    const feedResults = await Promise.all(
      allFeeds.map((f) => fetchRssItems(f.feedUrl)),
    );
    console.log(`RSS fetch complete. Deduplicating…`);

    // Step 2: flatten + deduplicate by URL (in-memory, within this run)
    const processedUrls = new Set<string>();
    const queue: RssItem[] = [];
    for (const items of feedResults) {
      for (const item of items) {
        if (!item.url || processedUrls.has(item.url)) continue;
        processedUrls.add(item.url);
        queue.push(item);
      }
    }
    console.log(`${queue.length} unique articles fetched`);

    // Step 3: filter out articles already stored in the sources table
    const knownUrls = await loadKnownUrls(supabase);
    const freshQueue = queue.filter((item) => !knownUrls.has(item.url));
    console.log(
      `Skipped ${queue.length - freshQueue.length} already-known articles — ${freshQueue.length} new articles to process`,
    );

    if (freshQueue.length === 0) {
      console.log("No new articles found — exiting early");
      await supabase.from("scrape_log").insert({
        sources_checked: SEARCH_QUERIES.length,
        articles_found: 0,
        findings_created: 0,
        status: "partial",
        error_message: null,
        duration_ms: Date.now() - startTime,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: "No new articles",
          findings_created: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Step 4: pre-screen raw articles by title before clustering
    // (keeps the clustering prompt small — avoids its timeout)
    const relevantArticles = await preScreenArticles(geminiKey, freshQueue);

    // Step 6: cluster only relevant articles into topic groups
    const groups = await clusterItemsIntoGroups(geminiKey, relevantArticles);

    // Step 7: process groups in parallel batches, respecting a time budget
    // Hard cap ensures the function always finishes. Run the cron more
    // frequently (e.g. every 4-6h) to cover more articles per day.
    const BATCH_SIZE = 5;
    const TIME_BUDGET_MS = 380_000;
    const MAX_GROUPS_PER_RUN = 200;

    const toProcess = groups.slice(0, MAX_GROUPS_PER_RUN);
    if (groups.length > MAX_GROUPS_PER_RUN) {
      console.log(
        `Capping at ${MAX_GROUPS_PER_RUN} of ${groups.length} groups this run`,
      );
    }

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(
          `Time budget reached after ${i} of ${toProcess.length} groups — stopping early`,
        );
        break;
      }
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (group) => {
          articlesFound += group.length;
          console.log(
            `  Processing group (${group.length} article${group.length > 1 ? "s" : ""}): ${group[0].title || group[0].url}`,
          );
          const content = resolveGroupContent(group);
          return processArticle(supabase, geminiKey, group, content);
        }),
      );
      for (const r of results) {
        if (r !== false) {
          findingsCreated++;
          if (MONEY_CATEGORIES.has(r)) moneyFindingsCreated++;
        }
      }
    }

    // ── Supplemental money-corruption pass ────────────────────────────────────
    // If fewer than 2 financial/money findings were created, fetch targeted
    // money-corruption RSS feeds and process them until we reach 2 or run out.
    if (moneyFindingsCreated < 2 && Date.now() - startTime < TIME_BUDGET_MS) {
      console.log(
        `Only ${moneyFindingsCreated} money finding(s) so far — running supplemental money-corruption pass`,
      );

      const moneyMidpoint = Math.ceil(MONEY_QUERIES.length / 2);
      const moneyFeeds = MONEY_QUERIES.map((q, i) =>
        googleNewsRssUrl(q, i < moneyMidpoint ? "when:30d" : archiveFilter),
      );
      const moneyFeedResults = await Promise.all(
        moneyFeeds.map((url) => fetchRssItems(url)),
      );

      const moneyQueue: RssItem[] = [];
      for (const items of moneyFeedResults) {
        for (const item of items) {
          if (!item.url || processedUrls.has(item.url) || knownUrls.has(item.url)) continue;
          processedUrls.add(item.url);
          moneyQueue.push(item);
        }
      }
      console.log(`Supplemental pass: ${moneyQueue.length} new money-related articles`);

      if (moneyQueue.length > 0) {
        const moneyRelevant = await preScreenArticles(geminiKey, moneyQueue);
        const moneyGroups = await clusterItemsIntoGroups(geminiKey, moneyRelevant);

        for (const group of moneyGroups) {
          if (moneyFindingsCreated >= 2) break;
          if (Date.now() - startTime > TIME_BUDGET_MS) break;
          articlesFound += group.length;
          console.log(
            `  [money pass] Processing group (${group.length} article${group.length > 1 ? "s" : ""}): ${group[0].title || group[0].url}`,
          );
          const content = resolveGroupContent(group);
          const result = await processArticle(supabase, geminiKey, group, content);
          if (result !== false) {
            findingsCreated++;
            if (MONEY_CATEGORIES.has(result)) moneyFindingsCreated++;
          }
        }
        console.log(
          `Supplemental pass done — total money findings this run: ${moneyFindingsCreated}`,
        );
      }
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error("Fatal error:", lastError);
  }

  const duration = Date.now() - startTime;

  await supabase.from("scrape_log").insert({
    sources_checked: SEARCH_QUERIES.length,
    articles_found: articlesFound,
    findings_created: findingsCreated,
    status: lastError ? "error" : findingsCreated > 0 ? "success" : "partial",
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
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
