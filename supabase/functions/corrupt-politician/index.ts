/**
 * corrupt-politician — Supabase Edge Function (Deno)
 *
 * Standalone cron job that runs independently from scrape-analyze.
 * Scans all findings for people mentioned, classifies each person as a
 * politician or non-politician using Gemini, and enriches confirmed
 * politicians with Wikipedia photo data.
 *
 * Recommended cron schedule (set in Supabase pg_cron):
 *   Run 1 — 08:00 Panama time (13:00 UTC):  0 13 * * *
 *   Run 2 — 20:00 Panama time (01:00 UTC+1): 0 1  * * *
 *
 * Each run processes up to MAX_PER_RUN unclassified people. Running twice
 * daily keeps the politicians page up to date as scrape-analyze adds cases.
 *
 * Deploy: supabase functions deploy corrupt-politician
 * Secret:  supabase secrets set GEMINI_API_KEY=AIza...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_PER_RUN = 200;

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

// ── Wikipedia photo fetch ─────────────────────────────────────────────────────

interface WikiPhotoData {
  photo_url: string | null;
  photo_source_url: string | null;
  photo_source_name: string | null;
}

const PANAMA_POLITICAL_KEYWORDS = [
  "panamá", "panama", "panameño", "panameña",
  "presidente", "vicepresidente", "ministro", "ministra",
  "diputado", "diputada", "alcalde", "alcaldesa",
  "magistrado", "magistrada", "fiscal", "contralor",
  "asamblea nacional", "gobierno", "político", "política",
];

// Returns the Wikipedia page title to use for summary lookup, by searching
// for the person's name scoped to Panama politics. Falls back to the raw name.
async function resolveWikipediaTitle(lang: string, name: string): Promise<string> {
  const searchQuery = `${name} Panamá político`;
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?` +
    `action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}` +
    `&srlimit=3&format=json&origin=*`;

  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return name;
    const data = await res.json();
    const hits: Array<{ title: string; snippet: string }> = data?.query?.search ?? [];

    // Pick the first hit whose title contains the person's last name
    const lastName = name.trim().split(/\s+/).at(-1)!.toLowerCase();
    const match = hits.find((h) => h.title.toLowerCase().includes(lastName));
    return match?.title ?? name;
  } catch {
    return name;
  }
}

async function fetchWikipediaPhoto(name: string): Promise<WikiPhotoData> {
  const nameParts = name.toLowerCase().split(/\s+/);
  // Require at least the last name to appear in the page text
  const lastName = nameParts.at(-1)!;

  for (const [lang, label] of [
    ["es", "Wikipedia (es)"],
    ["en", "Wikipedia"],
  ] as [string, string][]) {
    try {
      const title = await resolveWikipediaTitle(lang, name);
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.thumbnail?.source) continue;

      // Validate: page must mention the person's last name
      const pageText = `${data.title} ${data.description ?? ""} ${data.extract ?? ""}`.toLowerCase();
      if (!pageText.includes(lastName)) {
        console.warn(`[wikipedia] Rejected page "${data.title}" for "${name}" — last name not found`);
        continue;
      }

      // Validate: page must have Panama/political context
      const hasContext = PANAMA_POLITICAL_KEYWORDS.some((kw) => pageText.includes(kw));
      if (!hasContext) {
        console.warn(`[wikipedia] Rejected page "${data.title}" for "${name}" — no Panama/political context`);
        continue;
      }

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

// ── Batch politician classification ──────────────────────────────────────────

interface GeminiClassification {
  is_politician: boolean;
  political_position: string | null;
  political_party: string | null;
  tenure_start: string | null;
  tenure_end: string | null;
}

async function classifyPeopleBatch(
  apiKey: string,
  people: Array<{ id: string; name: string; role: string | null }>,
): Promise<Map<string, GeminiClassification>> {
  const list = people
    .map((p, i) => `[${i}] ${p.name} — rol: ${p.role ?? "desconocido"}`)
    .join("\n");

  const prompt = `Analiza si cada una de las siguientes personas es o fue un político o funcionario público panameño.

${list}

Responde ÚNICAMENTE con un array JSON válido (sin markdown), con exactamente ${people.length} objetos en el mismo orden:
[
  { "is_politician": bool, "political_position": string|null, "political_party": string|null, "tenure_start": "YYYY"|null, "tenure_end": "YYYY"|null },
  ...
]`;

  const raw = await callGemini(apiKey, prompt, 55_000);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`Gemini returned non-JSON array: ${raw.slice(0, 200)}`);

  const results = JSON.parse(match[0]) as GeminiClassification[];
  const map = new Map<string, GeminiClassification>();
  for (let i = 0; i < people.length; i++) {
    if (results[i]) map.set(people[i].id, results[i]);
  }
  return map;
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

  // Step 1: collect every person_id that appears in at least one finding
  const { data: findingPeopleRows, error: fpError } = await supabase
    .from("finding_people")
    .select("person_id");

  if (fpError) {
    return new Response(JSON.stringify({ error: fpError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allPersonIds = [
    ...new Set((findingPeopleRows ?? []).map((r: { person_id: string }) => r.person_id)),
  ];

  // Step 2: collect person_ids already classified
  const { data: classifiedRows } = await supabase
    .from("politicians")
    .select("person_id")
    .eq("is_processed", true);

  const classifiedIds = new Set(
    (classifiedRows ?? []).map((r: { person_id: string }) => r.person_id),
  );

  // Step 3: determine which ones still need classification
  const unclassifiedIds = allPersonIds
    .filter((id) => !classifiedIds.has(id))
    .slice(0, MAX_PER_RUN);

  console.log(
    `[corrupt-politician] ${allPersonIds.length} people in findings, ` +
      `${classifiedIds.size} already classified, ` +
      `${unclassifiedIds.length} to process this run`,
  );

  if (unclassifiedIds.length === 0) {
    const duration = Date.now() - startTime;
    console.log("[corrupt-politician] All people already classified — done");
    return new Response(
      JSON.stringify({ processed: 0, politicians_found: 0, duration_ms: duration }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Step 4: fetch person details
  const { data: candidates, error: peopleError } = await supabase
    .from("people")
    .select("id, name, role")
    .in("id", unclassifiedIds);

  if (peopleError) {
    return new Response(JSON.stringify({ error: peopleError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const people = candidates ?? [];
  let processed = 0;
  let politiciansFound = 0;

  // One Gemini call classifies everyone at once
  const classifications = await classifyPeopleBatch(geminiKey, people);
  console.log(`[corrupt-politician] Gemini classified ${classifications.size} people`);

  // Fetch Wikipedia photos in parallel only for confirmed politicians
  const politicians = people.filter((p) => classifications.get(p.id)?.is_politician);
  const photoResults = await Promise.all(
    politicians.map((p) => fetchWikipediaPhoto(p.name)),
  );
  const photoMap = new Map<string, WikiPhotoData>(
    politicians.map((p, i) => [p.id, photoResults[i]]),
  );

  const noPhoto: WikiPhotoData = { photo_url: null, photo_source_url: null, photo_source_name: null };

  // Upsert all results
  for (const person of people) {
    const classification = classifications.get(person.id);
    if (!classification) continue;

    try {
      await upsertPolitician(
        supabase,
        person.id,
        classification,
        photoMap.get(person.id) ?? noPhoto,
      );
      processed++;
      if (classification.is_politician) {
        politiciansFound++;
        console.log(`[corrupt-politician] ✓ ${person.name}: ${classification.political_position ?? "político"}`);
      }
    } catch (err) {
      console.error(`[corrupt-politician] Failed upsert for ${person.name}:`, err);
    }
  }

  const duration = Date.now() - startTime;
  const result = { processed, politicians_found: politiciansFound, duration_ms: duration };
  console.log(`[corrupt-politician] Done — ${JSON.stringify(result)}`);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
