/**
 * corrupt-politician — Supabase Edge Function (Deno)
 *
 * Classifies public figures as politicians using Gemini and enriches them
 * with Wikipedia photo data. Triggered fire-and-forget after each scrape run.
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

  // Extract JSON from possible markdown code fence
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Gemini returned non-JSON: ${raw}`);
  return JSON.parse(match[0]) as GeminiClassification;
}

interface WikiSummary {
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchWikipediaPhoto(name: string): Promise<{
  photo_url: string | null;
  photo_source_url: string | null;
  photo_source_name: string | null;
}> {
  const encoded = encodeURIComponent(name);

  // Try Spanish Wikipedia first
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
      const data: WikiSummary = await res.json();
      if (!data.thumbnail?.source) continue;
      return {
        photo_url: data.thumbnail.source,
        photo_source_url: data.content_urls?.desktop?.page ?? null,
        photo_source_name: label,
      };
    } catch {
      // fall through to next lang
    }
  }

  return { photo_url: null, photo_source_url: null, photo_source_name: null };
}

Deno.serve(async (_req) => {
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch unprocessed public figures (no politicians row yet)
  const { data: candidates, error: fetchError } = await supabase
    .from("people")
    .select("id, name, role")
    .eq("is_public_figure", true)
    .not(
      "id",
      "in",
      `(SELECT person_id FROM politicians WHERE is_processed = true)`,
    )
    .limit(MAX_PER_RUN);

  if (fetchError) {
    console.error("Failed to fetch candidates:", fetchError);
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const people = candidates ?? [];
  console.log(`Processing ${people.length} unprocessed public figures`);

  let processed = 0;
  let politiciansFound = 0;

  for (const person of people) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.log("Time budget reached — stopping early");
      break;
    }

    try {
      const classification = await classifyPerson(
        geminiKey,
        person.name,
        person.role,
      );

      let photoData = { photo_url: null, photo_source_url: null, photo_source_name: null };

      if (classification.is_politician) {
        politiciansFound++;
        photoData = await fetchWikipediaPhoto(person.name);
      }

      // Parse tenure dates (accept "YYYY" strings)
      const tenureStart = classification.tenure_start
        ? `${classification.tenure_start}-01-01`
        : null;
      const tenureEnd = classification.tenure_end
        ? `${classification.tenure_end}-12-31`
        : null;

      await supabase.from("politicians").upsert(
        {
          person_id: person.id,
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

      processed++;
      console.log(
        `${person.name}: ${classification.is_politician ? classification.political_position ?? "politician" : "not a politician"}`,
      );
    } catch (err) {
      console.error(`Failed to process ${person.name}:`, err);
    }

    // Rate limiting delay
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const duration = Date.now() - startTime;
  console.log(
    `Done — processed: ${processed}, politicians found: ${politiciansFound}, duration: ${duration}ms`,
  );

  return new Response(
    JSON.stringify({ processed, politicians_found: politiciansFound, duration_ms: duration }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
