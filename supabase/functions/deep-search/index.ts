/**
 * deep-search — Supabase Edge Function (Deno)
 *
 * Targeted search for a specific person by name. Fetches news, uses Gemini to
 * extract structured findings, and optionally saves them to the database.
 *
 * Modes:
 *   POST { name: string }
 *     → returns { person, findings } preview (no DB writes)
 *
 *   POST { name: string, confirm: true, person: {...}, findings: [...] }
 *     → saves to DB and returns { saved: true, person_id, finding_ids }
 *
 * Deploy: supabase functions deploy deep-search
 * Secret:  supabase secrets set GEMINI_API_KEY=AIza...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface PreviewSource {
  url: string;
  title: string | null;
  outlet: string | null;
  published_at: string | null;
}

interface PreviewPerson {
  name: string;
  role_in_case: string | null;
  amount_usd: number | null;
  is_convicted: boolean;
}

interface PreviewFinding {
  title: string;
  summary: string;
  severity: "critico" | "alto" | "medio" | "bajo";
  category: string;
  amount_usd: number | null;
  date_occurred: string | null;
  sources: PreviewSource[];
  people: PreviewPerson[];
}

interface PreviewPolitician {
  name: string;
  political_position: string | null;
  political_party: string | null;
  tenure_start: string | null;
  tenure_end: string | null;
  bio: string | null;
  photo_url: string | null;
  photo_source_url: string | null;
  photo_source_name: string | null;
}

// ── Gemini ─────────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string, timeoutMs = 60_000): Promise<string> {
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

  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text as string;
}

// ── RSS + article helpers (shared with scrape-analyze) ────────────────────────

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

interface RssItem {
  url: string;
  title: string;
  description: string;
  outlet: string;
  pubDate: string | null;
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
      const titleRaw = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const title = stripHtml(extractCdata(titleRaw));
      const linkRaw =
        chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
        chunk.match(/<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ??
        "";
      const url = extractCdata(linkRaw).trim();
      const descRaw = chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "";
      const description = stripHtml(extractCdata(descRaw));
      const outletRaw = chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";
      const outlet = stripHtml(extractCdata(outletRaw)) || "Desconocido";
      const pubDate = chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? null;

      if (!url || url.startsWith("#")) continue;
      items.push({ url, title, description, outlet, pubDate });
    }

    return items.slice(0, 8);
  } catch {
    return [];
  }
}

async function fetchArticleBody(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return "";
    const html = await response.text();
    return stripHtml(
      html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " "),
    ).slice(0, 3000);
  } catch {
    return "";
  }
}

// ── Wikipedia photo (reused from corrupt-politician) ──────────────────────────

const PANAMA_POLITICAL_KEYWORDS = [
  "panamá", "panama", "panameño", "panameña",
  "presidente", "vicepresidente", "ministro", "ministra",
  "diputado", "diputada", "alcalde", "alcaldesa",
  "magistrado", "magistrada", "fiscal", "contralor",
  "asamblea nacional", "gobierno", "político", "política",
];

async function resolveWikipediaTitle(lang: string, name: string): Promise<string> {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?` +
    `action=query&list=search&srsearch=${encodeURIComponent(name + " Panamá político")}` +
    `&srlimit=3&format=json&origin=*`;
  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return name;
    const data = await res.json();
    const hits: Array<{ title: string }> = data?.query?.search ?? [];
    const lastName = name.trim().split(/\s+/).at(-1)!.toLowerCase();
    const match = hits.find((h) => h.title.toLowerCase().includes(lastName));
    return match?.title ?? name;
  } catch {
    return name;
  }
}

interface WikiPhotoData {
  photo_url: string | null;
  photo_source_url: string | null;
  photo_source_name: string | null;
}

async function fetchWikipediaPhoto(name: string): Promise<WikiPhotoData> {
  const lastName = name.toLowerCase().split(/\s+/).at(-1)!;
  for (const [lang, label] of [["es", "Wikipedia (es)"], ["en", "Wikipedia"]] as [string, string][]) {
    try {
      const title = await resolveWikipediaTitle(lang, name);
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(5_000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.thumbnail?.source) continue;
      const pageText = `${data.title} ${data.description ?? ""} ${data.extract ?? ""}`.toLowerCase();
      if (!pageText.includes(lastName)) continue;
      if (!PANAMA_POLITICAL_KEYWORDS.some((kw) => pageText.includes(kw))) continue;
      return {
        photo_url: data.thumbnail.source,
        photo_source_url: data.content_urls?.desktop?.page ?? null,
        photo_source_name: label,
      };
    } catch { /* try next */ }
  }
  return { photo_url: null, photo_source_url: null, photo_source_name: null };
}

// ── Search + extract (preview mode) ───────────────────────────────────────────

async function deepSearch(
  geminiKey: string,
  name: string,
): Promise<{ person: PreviewPolitician; findings: PreviewFinding[] }> {
  const encoded = encodeURIComponent(name);
  const queries = [
    `${encoded}+panama+corrupcion`,
    `${encoded}+panama+investigado+imputado`,
    `${encoded}+panama+escandalo`,
  ];

  const feedUrls = queries.map(
    (q) => `https://news.google.com/rss/search?q=${q}&hl=es-419&gl=PA&ceid=PA:es-419`,
  );

  // Fetch all RSS feeds in parallel
  const rssResults = await Promise.all(feedUrls.map(fetchRssItems));
  const seenUrls = new Set<string>();
  const allItems: RssItem[] = [];
  for (const items of rssResults) {
    for (const item of items) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }
  }

  console.log(`[deep-search] Found ${allItems.length} articles for "${name}"`);

  if (allItems.length === 0) {
    const photo = await fetchWikipediaPhoto(name);
    return {
      person: {
        name,
        political_position: null,
        political_party: null,
        tenure_start: null,
        tenure_end: null,
        bio: null,
        ...photo,
      },
      findings: [],
    };
  }

  // Fetch article bodies in parallel (limit to 10)
  const topItems = allItems.slice(0, 10);
  const bodies = await Promise.all(topItems.map((item) => fetchArticleBody(item.url)));

  // Build article list for Gemini
  const articleList = topItems
    .map((item, i) => {
      const body = bodies[i] || item.description;
      return `--- ARTÍCULO ${i + 1} ---
URL: ${item.url}
Fuente: ${item.outlet}
Fecha: ${item.pubDate ?? "desconocida"}
Título: ${item.title}
Contenido: ${body.slice(0, 2000)}`;
    })
    .join("\n\n");

  const prompt = `Eres un analista experto en corrupción panameña. Se busca información sobre la persona: "${name}".

Analiza los siguientes artículos de noticias y extrae:
1. Información sobre "${name}" (cargo político, partido, período, breve bio)
2. Todos los hallazgos de corrupción, abuso o irregularidades donde "${name}" esté mencionado

IMPORTANTE: Solo incluye hallazgos donde "${name}" sea mencionado explícitamente o sea claramente identificable. Si no hay suficiente información, devuelve findings vacío.

${articleList}

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "person": {
    "name": "nombre completo como aparece en artículos",
    "political_position": "cargo o null",
    "political_party": "partido o null",
    "tenure_start": "YYYY o null",
    "tenure_end": "YYYY o null",
    "bio": "2-3 oraciones sobre quién es, o null"
  },
  "findings": [
    {
      "title": "título conciso del caso (máx 100 chars)",
      "summary": "resumen periodístico detallado en 2-3 párrafos",
      "severity": "critico" | "alto" | "medio" | "bajo",
      "category": "Fraude en Contratación Pública" | "Peculado / Malversación" | "Lavado de Dinero" | "Soborno / Cohecho" | "Tráfico de Influencias" | "Captura del Estado" | "Abuso en Emergencias" | "Corrupción en Seguridad" | "Negligencia y Abuso Institucional" | "Violación de Derechos Humanos",
      "amount_usd": number | null,
      "date_occurred": "YYYY-MM-DD" | null,
      "sources": [
        { "url": "...", "title": "título del artículo", "outlet": "medio de comunicación", "published_at": "YYYY-MM-DD" | null }
      ],
      "people": [
        { "name": "Nombre Completo", "role_in_case": "acusado|investigado|condenado|implicado|testigo|victima", "amount_usd": number | null, "is_convicted": boolean }
      ]
    }
  ]
}

Criterios de severidad:
- critico: >$1M + múltiples funcionarios + cargos penales confirmados
- alto: corrupción confirmada, montos significativos o funcionarios de alto nivel
- medio: bajo investigación formal, evidencia creíble pero sin condena
- bajo: irregularidades menores, alertas tempranas`;

  let result: { person: PreviewPolitician; findings: PreviewFinding[] };
  try {
    const raw = await callGemini(geminiKey, prompt, 90_000);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");
    result = JSON.parse(match[0]);
  } catch (err) {
    console.error("[deep-search] Gemini extraction failed:", err);
    result = {
      person: { name, political_position: null, political_party: null, tenure_start: null, tenure_end: null, bio: null, photo_url: null, photo_source_url: null, photo_source_name: null },
      findings: [],
    };
  }

  // Fetch Wikipedia photo
  const photo = await fetchWikipediaPhoto(result.person.name ?? name);
  result.person.photo_url = photo.photo_url;
  result.person.photo_source_url = photo.photo_source_url;
  result.person.photo_source_name = photo.photo_source_name;

  console.log(`[deep-search] Extracted ${result.findings.length} findings for "${name}"`);
  return result;
}

// ── Save to DB (confirm mode) ─────────────────────────────────────────────────

async function saveToDatabase(
  supabase: ReturnType<typeof createClient>,
  person: PreviewPolitician,
  findings: PreviewFinding[],
): Promise<{ person_id: string; finding_ids: string[] }> {
  // Insert main person
  const { data: personRow, error: personErr } = await supabase
    .from("people")
    .insert({
      name: person.name,
      nationality: "PA",
      is_public_figure: true,
      bio: person.bio ?? null,
    })
    .select("id")
    .single();

  if (personErr) throw new Error(`Failed to insert person: ${personErr.message}`);
  const personId = personRow.id as string;

  // Insert politician row
  await supabase.from("politicians").upsert(
    {
      person_id: personId,
      political_position: person.political_position,
      political_party: person.political_party,
      tenure_start: person.tenure_start ? `${person.tenure_start}-01-01` : null,
      tenure_end: person.tenure_end ? `${person.tenure_end}-12-31` : null,
      photo_url: person.photo_url,
      photo_source_url: person.photo_source_url,
      photo_source_name: person.photo_source_name,
      is_processed: true,
    },
    { onConflict: "person_id" },
  );

  const findingIds: string[] = [];

  for (const finding of findings) {
    // Insert finding
    const { data: findingRow, error: findingErr } = await supabase
      .from("findings")
      .insert({
        title: finding.title,
        summary: finding.summary,
        severity: finding.severity,
        category: finding.category,
        status: "activo",
        amount_usd: finding.amount_usd,
        date_occurred: finding.date_occurred,
      })
      .select("id")
      .single();

    if (findingErr) {
      console.error("[deep-search] Failed to insert finding:", findingErr.message);
      continue;
    }
    const findingId = findingRow.id as string;
    findingIds.push(findingId);

    // Insert sources
    if (finding.sources.length > 0) {
      await supabase.from("sources").insert(
        finding.sources.map((s) => ({
          finding_id: findingId,
          url: s.url,
          title: s.title,
          outlet: s.outlet,
          published_at: s.published_at,
        })),
      );
    }

    // Insert finding_people for the main person first
    const mainPersonInFinding = finding.people.find(
      (p) => p.name.toLowerCase().includes(person.name.split(" ")[0].toLowerCase()),
    );
    await supabase.from("finding_people").insert({
      finding_id: findingId,
      person_id: personId,
      role_in_case: mainPersonInFinding?.role_in_case ?? "investigado",
      amount_usd: mainPersonInFinding?.amount_usd ?? null,
      is_convicted: mainPersonInFinding?.is_convicted ?? false,
    });

    // Insert other people mentioned
    for (const p of finding.people) {
      if (p.name.toLowerCase().includes(person.name.split(" ")[0].toLowerCase())) continue;
      // Try to find or create person
      const { data: existingPeople } = await supabase
        .from("people")
        .select("id")
        .ilike("name", p.name)
        .limit(1);

      let otherId: string;
      if (existingPeople && existingPeople.length > 0) {
        otherId = existingPeople[0].id;
      } else {
        const { data: newPerson } = await supabase
          .from("people")
          .insert({ name: p.name, nationality: "PA", is_public_figure: false })
          .select("id")
          .single();
        if (!newPerson) continue;
        otherId = newPerson.id;
      }

      await supabase.from("finding_people").insert({
        finding_id: findingId,
        person_id: otherId,
        role_in_case: p.role_in_case,
        amount_usd: p.amount_usd,
        is_convicted: p.is_convicted,
      });
    }
  }

  // Mark all people in findings as processed via corrupt-politician background call
  // (fire-and-forget — don't await)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/corrupt-politician`, {
    method: "POST",
    headers: { Authorization: `Bearer ${anonKey}` },
  }).catch(() => {});

  return { person_id: personId, finding_ids: findingIds };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const name = body.name as string | undefined;
  if (!name || name.trim().length < 2) {
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (body.confirm) {
    // Confirm mode: save to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
      const saved = await saveToDatabase(
        supabase,
        body.person as PreviewPolitician,
        (body.findings as PreviewFinding[]) ?? [],
      );
      return new Response(JSON.stringify({ saved: true, ...saved }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[deep-search] Save failed:", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  // Search mode: preview only
  try {
    const result = await deepSearch(geminiKey, name.trim());
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[deep-search] Search failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
