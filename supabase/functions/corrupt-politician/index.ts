/**
 * corrupt-politician — Supabase Edge Function (Deno)
 *
 * Primary mode: classifies unprocessed public figures as politicians using
 * Gemini and enriches them with Wikipedia photo data.
 *
 * Fallback mode (no unprocessed figures): runs a targeted politician news
 * scrape, inserts findings into the DB, and immediately creates politician
 * rows for any public figures extracted.
 *
 * Deploy: supabase functions deploy corrupt-politician
 * Secret:  supabase secrets set GEMINI_API_KEY=AIza...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_PER_RUN = 50;
const TIME_BUDGET_MS = 270_000;
const DELAY_MS = 500;

// ── Politician-focused RSS queries ────────────────────────────────────────────

const POLITICIAN_QUERIES = [
  "presidente panama",
  "vicepresidente panama",
  "ministro panama corrupcion",
  "diputado panama investigado",
  "alcalde panama escandalo",
  "asamblea nacional panama irregularidad",
  "magistrado panama",
  "partido politico panama fraude",
  "funcionario publico panama imputado",
  "gobernador panama",
  "contralor panama",
  "fiscal panama corrupcion",
  "expresidente panama corrupcion",
  "exvicepresidente panama corrupcion",
  "exministro panama corrupcion",
  "exdiputado panama corrupcion",
  "exalcalde panama corrupcion",
  "excontralor panama corrupcion",
  "exfiscal panama corrupcion",
  "exfuncionario publico panama corrupcion",
  "exgobernador panama corrupcion",
  "excontralor panama corrupcion",
  "politicos panama corrupcion",
];

// ── Gemini ────────────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  prompt: string,
  timeoutMs = 30_000,
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

// ── RSS helpers (mirrored from scrape-analyze) ────────────────────────────────

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

      const linkRaw = chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "";
      const url = extractCdata(linkRaw).trim();

      const descRaw =
        chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "";
      const description = stripHtml(extractCdata(descRaw)).slice(0, 300);

      const sourceRaw =
        chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";
      const outlet = stripHtml(extractCdata(sourceRaw)) || "Desconocido";

      const pubDateRaw =
        chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
      const pubDate = extractCdata(pubDateRaw).trim() || null;

      if (url && title)
        items.push({ url, title, description, outlet, pubDate });
    }

    return items;
  } catch {
    return [];
  }
}

function googleNewsRssUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=es-419&gl=PA&ceid=PA:es-419`;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayInPanama(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().split("T")[0];
}

function pubDateToPanamaDate(pubDate: string): string | null {
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() - 5 * 3600 * 1000).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

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

// ── Wikipedia photo fetch ─────────────────────────────────────────────────────

interface WikiPhotoData {
  photo_url: string | null;
  photo_source_url: string | null;
  photo_source_name: string | null;
}

async function fetchWikipediaPhoto(name: string): Promise<WikiPhotoData> {
  const encoded = encodeURIComponent(name);
  for (const [lang, label] of [
    ["es", "Wikipedia (es)"],
    ["en", "Wikipedia"],
  ] as [string, string][]) {
    try {
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.thumbnail?.source) continue;
      return {
        photo_url: data.thumbnail.source,
        photo_source_url: data.content_urls?.desktop?.page ?? null,
        photo_source_name: label,
      };
    } catch {
      /* try next lang */
    }
  }
  return { photo_url: null, photo_source_url: null, photo_source_name: null };
}

// ── Politician classification (single Gemini call) ────────────────────────────

interface GeminiClassification {
  is_politician: boolean;
  political_position: string | null;
  political_party: string | null;
  tenure_start: string | null;
  tenure_end: string | null;
}

async function classifyPerson(
  apiKey: string,
  name: string,
  role: string | null,
): Promise<GeminiClassification> {
  const prompt = `Analiza si la siguiente persona es o fue un político o funcionario público panameño.
Nombre: ${name} — Rol conocido: ${role ?? "desconocido"}
Responde ÚNICAMENTE con JSON: { "is_politician": bool, "political_position": string|null, "political_party": string|null, "tenure_start": "YYYY"|null, "tenure_end": "YYYY"|null }`;

  const raw = await callGemini(apiKey, prompt, 20_000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Gemini returned non-JSON: ${raw}`);
  return JSON.parse(match[0]) as GeminiClassification;
}

// ── Upsert a politician row ───────────────────────────────────────────────────

async function upsertPolitician(
  supabase: ReturnType<typeof createClient>,
  personId: string,
  classification: GeminiClassification,
  photoData: WikiPhotoData,
) {
  const tenureStart = classification.tenure_start
    ? `${classification.tenure_start}-01-01`
    : null;
  const tenureEnd = classification.tenure_end
    ? `${classification.tenure_end}-12-31`
    : null;

  await supabase.from("politicians").upsert(
    {
      person_id: personId,
      political_position: classification.is_politician
        ? classification.political_position
        : null,
      political_party: classification.is_politician
        ? classification.political_party
        : null,
      tenure_start: tenureStart,
      tenure_end: tenureEnd,
      photo_url: photoData.photo_url,
      photo_source_url: photoData.photo_source_url,
      photo_source_name: photoData.photo_source_name,
      is_processed: true,
    },
    { onConflict: "person_id" },
  );
}

// ── Gemini extraction prompt (politician-focused) ─────────────────────────────

function buildExtractionPrompt(
  title: string,
  body: string,
  url: string,
): string {
  return `Analiza el siguiente artículo de noticias sobre un político o funcionario público panameño y extrae información estructurada.

URL: ${url}
Título: ${title}
Contenido: ${body.slice(0, 3000)}

Responde ÚNICAMENTE con JSON válido:
{
  "is_corruption_related": bool,
  "title": "título conciso en español (max 120 chars)",
  "summary": "resumen objetivo en 2-4 oraciones",
  "severity": "critico|alto|medio|bajo",
  "category": "Fraude en Contratación Pública|Peculado / Malversación|Lavado de Dinero|Soborno / Cohecho|Tráfico de Influencias|Captura del Estado|Abuso en Emergencias|Corrupción en Seguridad|Negligencia y Abuso Institucional|Violación de Derechos Humanos",
  "amount_usd": number|null,
  "date_occurred": "YYYY-MM-DD"|null,
  "people": [
    {
      "name": "Nombre Apellido",
      "role": "cargo institucional",
      "role_in_case": "rol en este caso",
      "amount_usd": number|null,
      "is_convicted": bool,
      "is_public_figure": bool
    }
  ],
  "relationships": [
    { "person_a": "Nombre A", "person_b": "Nombre B", "relationship": "familiar|socio_comercial|politico|empleado|otro", "description": "descripción opcional" }
  ]
}

Marca is_corruption_related = true si involucra uso indebido de poder, fondos públicos, abuso de cargo, o irregularidades por parte de un funcionario o partido político.`;
}

// ── PRIMARY MODE: classify unprocessed public figures ────────────────────────

async function runClassificationMode(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  startTime: number,
): Promise<{ processed: number; politiciansFound: number }> {
  const { data: candidates, error } = await supabase
    .from("people")
    .select("id, name, role")
    .eq("is_public_figure", true)
    .not(
      "id",
      "in",
      `(SELECT person_id FROM politicians WHERE is_processed = true)`,
    )
    .limit(MAX_PER_RUN);

  if (error) throw new Error(`Failed to fetch candidates: ${error.message}`);

  const people = candidates ?? [];
  console.log(`[classify] ${people.length} unprocessed public figures`);

  let processed = 0;
  let politiciansFound = 0;

  for (const person of people) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    try {
      const classification = await classifyPerson(
        geminiKey,
        person.name,
        person.role,
      );
      let photoData: WikiPhotoData = {
        photo_url: null,
        photo_source_url: null,
        photo_source_name: null,
      };

      if (classification.is_politician) {
        politiciansFound++;
        photoData = await fetchWikipediaPhoto(person.name);
      }

      await upsertPolitician(supabase, person.id, classification, photoData);
      processed++;
      console.log(
        `[classify] ${person.name}: ${classification.is_politician ? (classification.political_position ?? "politician") : "not a politician"}`,
      );
    } catch (err) {
      console.error(`[classify] Failed for ${person.name}:`, err);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  return { processed, politiciansFound };
}

// ── FALLBACK MODE: targeted politician news scrape ───────────────────────────

async function runScrapeFallback(
  supabase: ReturnType<typeof createClient>,
  geminiKey: string,
  startTime: number,
): Promise<{ findingsCreated: number; politiciansFound: number }> {
  console.log(
    "[scrape-fallback] No unprocessed figures — running targeted politician scrape",
  );

  // 1. Fetch RSS feeds in parallel
  const feedResults = await Promise.all(
    POLITICIAN_QUERIES.map((q) => fetchRssItems(googleNewsRssUrl(q))),
  );

  // 2. Deduplicate by URL
  const seen = new Set<string>();
  const allItems: RssItem[] = [];
  for (const items of feedResults) {
    for (const item of items) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        allItems.push(item);
      }
    }
  }
  console.log(
    `[scrape-fallback] ${allItems.length} unique articles from ${POLITICIAN_QUERIES.length} queries`,
  );

  if (allItems.length === 0) return { findingsCreated: 0, politiciansFound: 0 };

  // 3. Pre-screen with Gemini (titles only, keep relevant)
  let relevant = allItems;
  try {
    const itemList = allItems
      .map(
        (item, i) =>
          `[${i}] ${item.title}${item.description ? " — " + item.description.slice(0, 80) : ""}`,
      )
      .join("\n");

    const screenPrompt = `Eres un filtro de relevancia. Analiza estos titulares de noticias panameñas sobre políticos y devuelve SOLO los índices que cubran corrupción, irregularidades, investigaciones o uso indebido de poder por funcionarios públicos.

${itemList}

Responde ÚNICAMENTE con JSON: {"relevant":[0,5,12,...]}
Excluye noticias sobre elecciones normales, actos oficiales sin escándalo, eventos sociales o deportes.`;

    const text = await callGemini(geminiKey, screenPrompt, 30_000);
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const { relevant: indices } = JSON.parse(match[0]) as {
        relevant: number[];
      };
      const valid = indices.filter(
        (i) => Number.isInteger(i) && i >= 0 && i < allItems.length,
      );
      relevant = valid.map((i) => allItems[i]);
      console.log(
        `[scrape-fallback] Pre-screened: ${relevant.length} of ${allItems.length} relevant`,
      );
    }
  } catch (e) {
    console.warn("[scrape-fallback] Pre-screening failed, using all:", e);
  }

  if (relevant.length === 0) return { findingsCreated: 0, politiciansFound: 0 };

  // 4. Cluster into groups
  let groups: RssItem[][];
  try {
    const itemList = relevant
      .map(
        (item, i) =>
          `[${i}] ${item.title}${item.description ? " — " + item.description.slice(0, 120) : ""}`,
      )
      .join("\n");

    const clusterPrompt = `Agrupa los siguientes artículos por caso/evento específico. Artículos sobre el mismo escándalo, persona o incidente van juntos.

${itemList}

Responde ÚNICAMENTE con JSON válido: {"groups":[[0,3],[1,2],[4],...]}
Todo índice del 0 al ${relevant.length - 1} debe aparecer exactamente una vez.`;

    const text = await callGemini(geminiKey, clusterPrompt, 30_000);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in cluster response");
    const { groups: raw } = JSON.parse(match[0]) as { groups: number[][] };

    const usedIdx = new Set<number>();
    groups = [];
    for (const g of raw) {
      const valid = g.filter(
        (i) =>
          Number.isInteger(i) &&
          i >= 0 &&
          i < relevant.length &&
          !usedIdx.has(i),
      );
      valid.forEach((i) => usedIdx.add(i));
      if (valid.length > 0) groups.push(valid.map((i) => relevant[i]));
    }
    for (let i = 0; i < relevant.length; i++) {
      if (!usedIdx.has(i)) groups.push([relevant[i]]);
    }
  } catch {
    groups = relevant.map((item) => [item]);
  }
  console.log(`[scrape-fallback] ${groups.length} groups to process`);

  // 5. Process each group
  let findingsCreated = 0;
  let politiciansFound = 0;

  for (const group of groups) {
    if (Date.now() - startTime > TIME_BUDGET_MS) break;

    const primary = group[0];
    const body = group
      .map(
        (item) =>
          `${item.outlet}: ${item.title}${item.description ? "\n" + item.description : ""}`,
      )
      .join("\n\n");

    let extracted: Record<string, unknown>;
    try {
      const rawText = await callGemini(
        geminiKey,
        buildExtractionPrompt(primary.title, body, primary.url),
        30_000,
      );
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) continue;
      extracted = JSON.parse(match[0]);
    } catch (e) {
      console.error("[scrape-fallback] Gemini extraction failed:", e);
      continue;
    }

    if (!extracted.is_corruption_related) continue;
    if (!extracted.title || !extracted.summary) continue;

    const dup = await isDuplicate(
      supabase,
      String(extracted.title),
      group.map((i) => i.url),
    );
    if (dup) {
      console.log(`[scrape-fallback] Duplicate, skipping: ${extracted.title}`);
      continue;
    }

    const verifiedFlags = await Promise.all(group.map((i) => verifyUrl(i.url)));
    const primaryVerifiedUrl =
      group.find((_, idx) => verifiedFlags[idx])?.url ?? null;

    const todayPanama = todayInPanama();
    const groupDates = group
      .map((i) => (i.pubDate ? pubDateToPanamaDate(i.pubDate) : null))
      .filter((d): d is string => d !== null && d <= todayPanama);
    const dateReported =
      groupDates.length > 0
        ? groupDates.sort().at(-1)!
        : ((extracted.date_occurred as string | null) ?? todayPanama);

    const { data: finding, error: findingError } = await supabase
      .from("findings")
      .insert({
        title: String(extracted.title),
        summary: String(extracted.summary),
        severity: extracted.severity ?? "bajo",
        category: extracted.category ?? "Tráfico de Influencias",
        amount_usd: extracted.amount_usd ?? null,
        date_occurred: extracted.date_occurred ?? null,
        date_reported: dateReported,
        source_url: primaryVerifiedUrl,
      })
      .select("id")
      .single();

    if (findingError) {
      console.error(
        "[scrape-fallback] DB error inserting finding:",
        findingError,
      );
      continue;
    }

    const findingId = finding.id;
    findingsCreated++;
    console.log(`[scrape-fallback] ✓ Created finding: ${extracted.title}`);

    // Insert sources
    for (let idx = 0; idx < group.length; idx++) {
      if (!verifiedFlags[idx]) continue;
      const item = group[idx];
      let pubDateStr: string | null = null;
      if (item.pubDate) {
        try {
          pubDateStr = new Date(item.pubDate).toISOString().split("T")[0];
        } catch {
          /* */
        }
      }
      await supabase.from("sources").insert({
        finding_id: findingId,
        url: item.url,
        title: primary.title || item.title || null,
        outlet: item.outlet,
        published_at:
          pubDateStr ?? (extracted.date_occurred as string | null) ?? null,
      });
    }

    // Insert people + finding_people, and create politician rows for public figures
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

        // Immediately classify + insert politician row for public figures
        if (p.is_public_figure) {
          try {
            // Check if already processed
            const { data: existing } = await supabase
              .from("politicians")
              .select("id")
              .eq("person_id", personId)
              .eq("is_processed", true)
              .limit(1);

            if (!existing || existing.length === 0) {
              const classification = await classifyPerson(
                geminiKey,
                p.name,
                p.role ?? null,
              );
              let photoData: WikiPhotoData = {
                photo_url: null,
                photo_source_url: null,
                photo_source_name: null,
              };
              if (classification.is_politician) {
                politiciansFound++;
                photoData = await fetchWikipediaPhoto(p.name);
              }
              await upsertPolitician(
                supabase,
                personId,
                classification,
                photoData,
              );
              console.log(
                `[scrape-fallback] Classified ${p.name}: ${classification.is_politician ? (classification.political_position ?? "politician") : "not a politician"}`,
              );
              await new Promise((r) => setTimeout(r, DELAY_MS));
            }
          } catch (e) {
            console.error(`[scrape-fallback] Failed to classify ${p.name}:`, e);
          }
        }
      } catch (e) {
        console.error(`[scrape-fallback] Error inserting person ${p.name}:`, e);
      }
    }

    // Insert relationships
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
  }

  return { findingsCreated, politiciansFound };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check how many unprocessed public figures exist
  const { count } = await supabase
    .from("people")
    .select("id", { count: "exact", head: true })
    .eq("is_public_figure", true)
    .not(
      "id",
      "in",
      `(SELECT person_id FROM politicians WHERE is_processed = true)`,
    );

  const unprocessedCount = count ?? 0;

  let result: Record<string, unknown>;

  if (unprocessedCount > 0) {
    // PRIMARY: classify existing public figures
    const { processed, politiciansFound } = await runClassificationMode(
      supabase,
      geminiKey,
      startTime,
    );
    result = {
      mode: "classify",
      processed,
      politicians_found: politiciansFound,
    };
  } else {
    // FALLBACK: scrape politician news and insert findings + politicians
    const { findingsCreated, politiciansFound } = await runScrapeFallback(
      supabase,
      geminiKey,
      startTime,
    );
    result = {
      mode: "scrape_fallback",
      findings_created: findingsCreated,
      politicians_found: politiciansFound,
    };
  }

  const duration = Date.now() - startTime;
  console.log(`Done — ${JSON.stringify(result)}, duration: ${duration}ms`);

  return new Response(JSON.stringify({ ...result, duration_ms: duration }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
