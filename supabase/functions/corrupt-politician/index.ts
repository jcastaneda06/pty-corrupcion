/**
 * corrupt-politician — Supabase Edge Function (Deno)
 *
 * Standalone cron job that runs independently from scrape-analyze.
 * Scans all findings for people mentioned, classifies each person as a
 * politician or non-politician using Gemini, and enriches confirmed
 * politicians with Wikipedia photo data.
 *
 * Deduplication strategy:
 *   Before calling Gemini, all existing politicians are fetched from the DB
 *   and passed to the AI. Gemini decides whether a new person is already
 *   represented by an existing entry, preventing duplicate rows.
 *
 * Identity filtering:
 *   People with insufficient identity info (single name token, generic titles,
 *   clearly anonymous references) are skipped. If a person has only one name
 *   token, a Wikipedia search is attempted to resolve their full identity.
 *
 * Recommended cron schedule (set in Supabase pg_cron):
 *   Run 1 — 08:00 Panama time (13:00 UTC):  0 13 * * *
 *   Run 2 — 20:00 Panama time (01:00 UTC+1): 0 1  * * *
 *
 * Deploy: supabase functions deploy corrupt-politician
 * Secret:  supabase secrets set GEMINI_API_KEY=AIza...
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const MAX_PER_RUN = 200;

// Generic single-word references that are clearly not real person names
const GENERIC_NAME_PATTERNS = [
  /^el\s+(ministro|presidente|director|fiscal|magistrado|alcalde|diputado|funcionario|contralor|gerente|rector|secretario)$/i,
  /^la\s+(ministra|presidenta|directora|fiscal|magistrada|alcaldesa|diputada|funcionaria|contralora|gerente|rectora|secretaria)$/i,
  /^(un|una)\s+funcionario/i,
  /^funcionario$/i,
  /^testigo$/i,
  /^víctima$/i,
  /^denunciante$/i,
  /^fuente$/i,
  /^informante$/i,
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

// ── Identity resolution ───────────────────────────────────────────────────────

/**
 * Returns true if the name has enough tokens to identify a real person
 * (at least first + last name) and is not a generic title reference.
 */
function hasCompleteName(name: string): boolean {
  const trimmed = name.trim();

  // Reject clearly generic references
  if (GENERIC_NAME_PATTERNS.some((re) => re.test(trimmed))) return false;

  // Require at least 2 word tokens
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 1);
  return tokens.length >= 2;
}

/**
 * Attempts to resolve a single-token name into a full name via Wikipedia search.
 * Returns the resolved full name, or null if we cannot identify the person.
 */
async function resolvePartialName(
  name: string,
  role: string | null,
): Promise<string | null> {
  const query = role
    ? `${name} ${role} Panamá político`
    : `${name} Panamá político`;

  const searchUrl =
    `https://es.wikipedia.org/w/api.php?` +
    `action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&srlimit=3&format=json&origin=*`;

  try {
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return null;
    const data = await res.json();
    const hits: Array<{ title: string; snippet: string }> = data?.query?.search ?? [];

    const nameLower = name.toLowerCase();
    for (const hit of hits) {
      const titleLower = hit.title.toLowerCase();
      if (!titleLower.includes(nameLower)) continue;

      // Verify it's a real person entry (title has at least 2 tokens)
      const tokens = hit.title.trim().split(/\s+/);
      if (tokens.length >= 2) {
        console.log(`[identity] Resolved "${name}" → "${hit.title}" via Wikipedia`);
        return hit.title;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

// ── Batch politician classification ──────────────────────────────────────────

interface ExistingPolitician {
  person_id: string;
  name: string;
  political_position: string | null;
}

interface GeminiClassification {
  is_politician: boolean;
  political_position: string | null;
  political_party: string | null;
  tenure_start: string | null;
  tenure_end: string | null;
  /** If this person is the same as an already-existing politician, their person_id */
  duplicate_of: string | null;
}

async function classifyPeopleBatch(
  apiKey: string,
  people: Array<{ id: string; name: string; role: string | null }>,
  existingPoliticians: ExistingPolitician[],
): Promise<Map<string, GeminiClassification>> {
  const list = people
    .map((p, i) => `[${i}] id=${p.id} | ${p.name} — rol: ${p.role ?? "desconocido"}`)
    .join("\n");

  const existingList = existingPoliticians.length > 0
    ? existingPoliticians
        .map((ep) => `  id=${ep.person_id} | ${ep.name}${ep.political_position ? ` (${ep.political_position})` : ""}`)
        .join("\n")
    : "  (ninguno aún)";

  const prompt = `Analiza si cada una de las siguientes personas es o fue un político o funcionario público panameño.

POLÍTICOS YA REGISTRADOS EN LA BASE DE DATOS (compara con estos para evitar duplicados):
${existingList}

PERSONAS A CLASIFICAR:
${list}

Para cada persona a clasificar:
1. Determina si es o fue político/funcionario público panameño (is_politician).
2. Si es político, verifica si ya existe en la lista de registrados. Usa el nombre completo y posición política para decidir. Si es la misma persona (aunque el nombre esté escrito diferente o incompleto), devuelve su "person_id" existente en el campo "duplicate_of".
3. Si no es la misma persona que ninguna registrada, devuelve "duplicate_of": null.

Responde ÚNICAMENTE con un array JSON válido (sin markdown), con exactamente ${people.length} objetos en el mismo orden que las personas a clasificar:
[
  {
    "is_politician": bool,
    "political_position": string|null,
    "political_party": string|null,
    "tenure_start": "YYYY"|null,
    "tenure_end": "YYYY"|null,
    "duplicate_of": string|null
  },
  ...
]`;

  const raw = await callGemini(apiKey, prompt, 60_000);
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

  // Step 2: collect ALL existing politician rows (for dedup) and which are already processed
  const { data: existingPoliticianRows } = await supabase
    .from("politicians")
    .select("person_id, political_position, is_processed");

  const existingPoliticianData = existingPoliticianRows ?? [];
  const classifiedIds = new Set(
    existingPoliticianData
      .filter((r: { is_processed: boolean }) => r.is_processed)
      .map((r: { person_id: string }) => r.person_id),
  );

  // Fetch names for existing politicians so we can pass them to Gemini for dedup
  const existingPoliticianPersonIds = existingPoliticianData
    .filter((r: { is_processed: boolean; person_id: string }) => r.is_processed)
    .map((r: { person_id: string }) => r.person_id);

  let existingPoliticians: ExistingPolitician[] = [];
  if (existingPoliticianPersonIds.length > 0) {
    const { data: existingPeopleRows } = await supabase
      .from("people")
      .select("id, name")
      .in("id", existingPoliticianPersonIds);

    const nameById = new Map(
      (existingPeopleRows ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
    );

    existingPoliticians = existingPoliticianData
      .filter((r: { is_processed: boolean }) => r.is_processed)
      .map((r: { person_id: string; political_position: string | null }) => ({
        person_id: r.person_id,
        name: nameById.get(r.person_id) ?? "",
        political_position: r.political_position,
      }))
      .filter((ep: ExistingPolitician) => ep.name !== "");
  }

  // Step 3: determine which ones still need classification
  const unclassifiedIds = allPersonIds
    .filter((id) => !classifiedIds.has(id))
    .slice(0, MAX_PER_RUN);

  console.log(
    `[corrupt-politician] ${allPersonIds.length} people in findings, ` +
      `${classifiedIds.size} already classified, ` +
      `${unclassifiedIds.length} to process this run, ` +
      `${existingPoliticians.length} existing politicians for dedup`,
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

  // Step 5: filter out people with insufficient identity info
  const rawPeople = candidates ?? [];
  const people: Array<{ id: string; name: string; role: string | null }> = [];
  const skippedIds: string[] = [];

  for (const person of rawPeople) {
    if (hasCompleteName(person.name)) {
      people.push(person);
      continue;
    }

    // Attempt to resolve partial name via Wikipedia
    const resolved = await resolvePartialName(person.name, person.role);
    if (resolved) {
      // Update the name in the DB so future runs use the full name
      await supabase.from("people").update({ name: resolved }).eq("id", person.id);
      people.push({ ...person, name: resolved });
    } else {
      console.warn(
        `[corrupt-politician] Skipping "${person.name}" — identity too ambiguous`,
      );
      skippedIds.push(person.id);
      // Mark as processed so we don't retry every run
      await supabase.from("politicians").upsert(
        { person_id: person.id, is_processed: true, is_skipped_anonymous: true },
        { onConflict: "person_id" },
      );
    }
  }

  console.log(
    `[corrupt-politician] ${people.length} people to classify after identity filtering, ` +
      `${skippedIds.length} skipped (anonymous)`,
  );

  if (people.length === 0) {
    const duration = Date.now() - startTime;
    return new Response(
      JSON.stringify({ processed: 0, politicians_found: 0, skipped: skippedIds.length, duration_ms: duration }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let processed = 0;
  let politiciansFound = 0;
  let duplicatesSkipped = 0;

  // Step 6: One Gemini call classifies everyone at once, aware of existing politicians
  const classifications = await classifyPeopleBatch(geminiKey, people, existingPoliticians);
  console.log(`[corrupt-politician] Gemini classified ${classifications.size} people`);

  // Step 7: fetch Wikipedia photos in parallel only for confirmed NEW politicians
  const newPoliticians = people.filter((p) => {
    const c = classifications.get(p.id);
    return c?.is_politician && !c?.duplicate_of;
  });
  const photoResults = await Promise.all(
    newPoliticians.map((p) => fetchWikipediaPhoto(p.name)),
  );
  const photoMap = new Map<string, WikiPhotoData>(
    newPoliticians.map((p, i) => [p.id, photoResults[i]]),
  );

  const noPhoto: WikiPhotoData = { photo_url: null, photo_source_url: null, photo_source_name: null };

  // Step 8: upsert results
  for (const person of people) {
    const classification = classifications.get(person.id);
    if (!classification) continue;

    // If Gemini identified this as a duplicate of an existing politician, skip insertion
    if (classification.duplicate_of) {
      console.log(
        `[corrupt-politician] Duplicate: "${person.name}" is already recorded as person_id=${classification.duplicate_of} — skipping`,
      );
      // Mark this person_id as processed so we don't retry it
      await supabase.from("politicians").upsert(
        { person_id: person.id, is_processed: true, is_duplicate_of: classification.duplicate_of },
        { onConflict: "person_id" },
      );
      duplicatesSkipped++;
      processed++;
      continue;
    }

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
  const result = {
    processed,
    politicians_found: politiciansFound,
    duplicates_skipped: duplicatesSkipped,
    anonymous_skipped: skippedIds.length,
    duration_ms: duration,
  };
  console.log(`[corrupt-politician] Done — ${JSON.stringify(result)}`);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
