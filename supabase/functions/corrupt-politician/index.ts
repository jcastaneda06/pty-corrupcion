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
 *   Names are categorized as complete (≥2 real name tokens), partial (1 real
 *   name token), or invalid (generic role titles, placeholder initials, anonymous
 *   references). Invalid names are skipped immediately. Partial names are sent to
 *   Gemini with the finding's title/summary so Gemini can attempt to identify a
 *   known Panamanian public figure. Wikipedia is used only for confirmed new
 *   politicians' photo lookup.
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

const MAX_PER_RUN = 60; // keep well within the 150 s edge-function budget
const BUDGET_MS = 120_000; // stop scheduling new work at 120 s to leave buffer

const ROLE_TITLE_WORDS = new Set([
  // role/title words
  "agente","agentes","fiscal","fiscales","funcionario","funcionaria",
  "funcionarios","funcionarias","diputado","diputada","diputados","diputadas",
  "ministro","ministra","ministros","ministras","presidente","presidenta",
  "presidentes","presidentas","director","directora","directores","directoras",
  "magistrado","magistrada","magistrados","magistradas","alcalde","alcaldesa",
  "alcaldes","alcaldesas","contralor","contralora","contralores","controladoras",
  "secretario","secretaria","secretarios","secretarias","rector","rectora",
  "rectores","rectoras","gerente","gerentes","policía","policías",
  "servidor","servidora","servidores","servidoras","testigo","testigos",
  "víctima","víctimas","denunciante","denunciantes","fuente","fuentes",
  "informante","informantes","sospechoso","sospechosa","sospechosos","sospechosas",
  "imputado","imputada","imputados","imputadas","oficial","oficiales",
  "inspector","inspectora","inspectores","inspectoras","subdirector","subdirectora",
  "viceministro","viceministra","procurador","procuradora","procuradores","procuradoras",
  "embajador","embajadora","cónsul","cónsules","senador","senadora",
  "gobernador","gobernadora",
  // ex- prefixed role titles
  "exministro","exministra","exdiputado","exdiputada","expresidente","expresidenta",
  "exdirector","exdirectora","exmagistrado","exmagistrada","exalcalde","exalcaldesa",
  "exfiscal","exgobernador","exgobernadora","excontralor","excontralora",
  "exsecretario","exsecretaria","exviceministro","exviceministra",
  "exprocurador","exprocuradora","exembajador","exembajadora","exrector","exrectora",
  // collective / anonymous / generic nouns
  "ciudadano","ciudadana","ciudadanos","ciudadanas",
  "niño","niña","niños","niñas",
  "padre","madre","padres","madres","familiar","familiares",
  "vecino","vecina","vecinos","vecinas","persona","personas",
  "individuo","individuos","hombre","hombres","mujer","mujeres",
  "menor","menores","joven","jóvenes","adulto","adultos",
  "tres","dos","cuatro","cinco","varios","varias","múltiples",
  "desconocido","desconocida","desconocidos","desconocidas",
  "identificado","identificada","identificados","identificadas",
  "anónimo","anónima","anónimos","anónimas",
]);

const ARTICLE_WORDS = new Set(["el","la","los","las","un","una","unos","unas"]);

// Matches a trailing single uppercase letter (placeholder like "X", "Y", "Z")
const PLACEHOLDER_PATTERN = /\b[A-Z]\.?$/;

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
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4_000) });
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
        { signal: AbortSignal.timeout(5_000) },
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

// ── Name categorization ────────────────────────────────────────────────────────

function categorizePersonName(name: string): "complete" | "partial" | "invalid" {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "invalid";

  let tokens = trimmed.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return "invalid";

  // Strip leading articles (el, la, un, ...)
  while (tokens.length > 0 && ARTICLE_WORDS.has(tokens[0].toLowerCase())) {
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) return "invalid";

  // First token is a role/title word → invalid
  if (ROLE_TITLE_WORDS.has(tokens[0].toLowerCase())) return "invalid";

  // Ends with a single uppercase letter placeholder → invalid
  if (PLACEHOLDER_PATTERN.test(trimmed)) return "invalid";

  // Count real name tokens (not role words, not articles)
  const realTokens = tokens.filter(
    (t) => !ROLE_TITLE_WORDS.has(t.toLowerCase()) && !ARTICLE_WORDS.has(t.toLowerCase()),
  );

  if (realTokens.length === 0) return "invalid";
  if (realTokens.length === 1) return "partial";
  return "complete";
}

async function fetchFindingContextForPeople(
  supabase: ReturnType<typeof createClient>,
  personIds: string[],
): Promise<Map<string, { title: string; summary: string | null }>> {
  const contextMap = new Map<string, { title: string; summary: string | null }>();
  if (personIds.length === 0) return contextMap;

  const { data } = await supabase
    .from("finding_people")
    .select("person_id, findings(title, summary)")
    .in("person_id", personIds);

  for (const row of data ?? []) {
    if (!contextMap.has(row.person_id) && row.findings) {
      contextMap.set(row.person_id, {
        title: row.findings.title,
        summary: row.findings.summary ?? null,
      });
    }
  }
  return contextMap;
}

// ── Batch politician classification ──────────────────────────────────────────

interface ExistingPolitician {
  person_id: string;
  name: string;
  political_position: string | null;
}

interface GeminiClassification {
  is_politician: boolean;
  identifiable: boolean;
  political_position: string | null;
  political_party: string | null;
  tenure_start: string | null;
  tenure_end: string | null;
  /** If this person is the same as an already-existing politician, their person_id */
  duplicate_of: string | null;
}

async function classifyPeopleBatch(
  apiKey: string,
  people: Array<{ id: string; name: string; role: string | null; findingContext?: string }>,
  existingPoliticians: ExistingPolitician[],
): Promise<Map<string, GeminiClassification>> {
  const list = people
    .map((p, i) => {
      const ctx = p.findingContext ? `\n   Contexto del hallazgo: ${p.findingContext}` : "";
      return `[${i}] id=${p.id} | ${p.name} — rol: ${p.role ?? "desconocido"}${ctx}`;
    })
    .join("\n");

  const existingList = existingPoliticians.length > 0
    ? existingPoliticians
        .map((ep) => `  id=${ep.person_id} | ${ep.name}${ep.political_position ? ` (${ep.political_position})` : ""}`)
        .join("\n")
    : "  (ninguno aún)";

  const prompt = `Analiza si cada una de las siguientes personas es o fue un político o funcionario público panameño.

REGLA FUNDAMENTAL — NOMBRE COMPLETO OBLIGATORIO:
Solo puedes marcar "is_politician": true si la persona tiene un nombre completo que incluye
TANTO un nombre de pila (given name) COMO un apellido (surname) identificables para un
individuo panameño específico y real. Ejemplos de nombres INVÁLIDOS que deben recibir
"is_politician": false e "identifiable": false:
  - Nombres colectivos o genéricos: "Niñas", "Ciudadanos", "Padres", "Víctimas"
  - Títulos sin nombre: "Exministro de Panamá", "Fiscal", "El diputado"
  - Referencias anónimas: "Tres ciudadanos no identificados", "Persona desconocida"
  - Nombres parciales no identificables: "Juan", "García" (sin contexto suficiente)
  - Cualquier nombre que no corresponda a un individuo real, específico e identificable

POLÍTICOS YA REGISTRADOS EN LA BASE DE DATOS (compara con estos para evitar duplicados):
${existingList}

PERSONAS A CLASIFICAR:
${list}

Para cada persona a clasificar:
1. Verifica primero que el nombre sea de un individuo real con nombre + apellido. Si no, marca "is_politician": false e "identifiable": false inmediatamente.
2. Si el nombre es válido, determina si es o fue político/funcionario público panameño (is_politician).
3. Si es político, verifica si ya existe en la lista de registrados. Usa el nombre completo y posición política para decidir. Si es la misma persona (aunque el nombre esté escrito diferente o incompleto), devuelve su "person_id" existente en el campo "duplicate_of".
4. Si no es la misma persona que ninguna registrada, devuelve "duplicate_of": null.

Para personas con nombre PARCIAL (un solo nombre sin apellido o viceversa), usa el "Contexto
del hallazgo" para intentar identificar a quién se refiere. Si puedes identificar con
confianza a una persona pública panameña específica y conocida (nombre + apellido), devuelve
"identifiable": true. Si no, devuelve "identifiable": false e "is_politician": false.

Responde ÚNICAMENTE con un array JSON válido (sin markdown), con exactamente ${people.length} objetos en el mismo orden que las personas a clasificar:
[
  {
    "is_politician": bool,
    "identifiable": bool,
    "political_position": string|null,
    "political_party": string|null,
    "tenure_start": "YYYY"|null,
    "tenure_end": "YYYY"|null,
    "duplicate_of": string|null
  },
  ...
]`;

  const raw = await callGemini(apiKey, prompt, 80_000);
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

  // Step 5: categorize people into three buckets
  const rawPeople = candidates ?? [];
  const completePeople: typeof rawPeople = [];
  const partialPeople: typeof rawPeople = [];
  const invalidPeople: typeof rawPeople = [];

  for (const person of rawPeople) {
    const cat = categorizePersonName(person.name);
    if (cat === "complete") completePeople.push(person);
    else if (cat === "partial") partialPeople.push(person);
    else invalidPeople.push(person);
  }

  // Batch-upsert invalid people as skipped (single DB call)
  if (invalidPeople.length > 0) {
    await supabase.from("politicians").upsert(
      invalidPeople.map((p) => ({ person_id: p.id, is_processed: true, is_skipped_anonymous: true })),
      { onConflict: "person_id" },
    );
  }
  let skippedIds: string[] = invalidPeople.map((p) => p.id);

  // Fetch finding context for partial names
  const findingContextMap = await fetchFindingContextForPeople(
    supabase,
    partialPeople.map((p) => p.id),
  );

  // Build unified people array for Gemini
  const people: Array<{ id: string; name: string; role: string | null; findingContext?: string }> = [];
  for (const p of completePeople) {
    people.push({ id: p.id, name: p.name, role: p.role });
  }
  for (const p of partialPeople) {
    const ctx = findingContextMap.get(p.id);
    const findingContext = ctx
      ? `${ctx.title}${ctx.summary ? " — " + ctx.summary.slice(0, 300) : ""}`
          .replace(/"/g, "'")
          .replace(/[\r\n]+/g, " ")
          .trim()
      : undefined;
    people.push({ id: p.id, name: p.name, role: p.role, findingContext });
  }

  console.log(
    `[corrupt-politician] ${completePeople.length} complete, ${partialPeople.length} partial, ` +
      `${invalidPeople.length} invalid. ${people.length} queued for Gemini.`,
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

  // Step 7: fetch Wikipedia photos in parallel (batched) only for confirmed NEW politicians
  const newPoliticians = people.filter((p) => {
    const c = classifications.get(p.id);
    return c?.is_politician && !c?.duplicate_of;
  });
  const photoMap = new Map<string, WikiPhotoData>();
  const PHOTO_CONCURRENCY = 10;
  for (let i = 0; i < newPoliticians.length; i += PHOTO_CONCURRENCY) {
    if (Date.now() - startTime > BUDGET_MS) {
      console.warn("[corrupt-politician] Approaching time budget — skipping remaining photo fetches");
      break;
    }
    const batch = newPoliticians.slice(i, i + PHOTO_CONCURRENCY);
    const results = await Promise.all(batch.map((p) => fetchWikipediaPhoto(p.name)));
    for (let j = 0; j < batch.length; j++) {
      photoMap.set(batch[j].id, results[j]);
    }
  }

  const noPhoto: WikiPhotoData = { photo_url: null, photo_source_url: null, photo_source_name: null };

  // Step 8: upsert results
  for (const person of people) {
    const classification = classifications.get(person.id);
    if (!classification) continue;

    // Partial name Gemini could not identify → skip
    if ((classification.identifiable ?? true) === false) {
      console.warn(`[corrupt-politician] Unidentifiable: "${person.name}" — skipping`);
      await supabase.from("politicians").upsert(
        { person_id: person.id, is_processed: true, is_skipped_anonymous: true },
        { onConflict: "person_id" },
      );
      skippedIds.push(person.id);
      processed++;
      continue;
    }

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
