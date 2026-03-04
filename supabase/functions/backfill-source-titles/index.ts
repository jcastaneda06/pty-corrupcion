/**
 * backfill-source-titles — Supabase Edge Function
 *
 * Fetches HTML page titles for sources that have null title, then updates the DB.
 * Run manually: curl -X POST https://<project>.supabase.co/functions/v1/backfill-source-titles
 *
 * Deploy: supabase functions deploy backfill-source-titles
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PTYCorruptionBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const raw = titleMatch ? titleMatch[1].trim() : '';
    if (!raw) return null;
    // Decode common HTML entities
    return raw
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: sources, error: fetchError } = await supabase
    .from('sources')
    .select('id, url')
    .is('title', null);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!sources || sources.length === 0) {
    return new Response(
      JSON.stringify({ updated: 0, message: 'No sources with null title' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let updated = 0;
  for (const source of sources) {
    const title = await fetchPageTitle(source.url);
    if (title) {
      const { error } = await supabase
        .from('sources')
        .update({ title })
        .eq('id', source.id);
      if (!error) updated++;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return new Response(
    JSON.stringify({
      total: sources.length,
      updated,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
