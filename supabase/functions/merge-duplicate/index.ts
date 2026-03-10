/**
 * merge-duplicate — Supabase Edge Function (Deno)
 *
 * Merges two duplicate findings or people. Accepts POST with:
 *   { type: 'finding' | 'person', winner_id: string, loser_id: string }
 * Requires a valid user JWT in the Authorization header.
 *
 * Deploy: supabase functions deploy merge-duplicate
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth check via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // The gateway already verified the JWT — decode the payload to get the user ID
  const token = authHeader.replace("Bearer ", "");
  const userId = getJwtSub(token);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service-role client for all DB writes
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: { type: string; winner_id: string; loser_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { type, winner_id, loser_id } = body;
  if (!["finding", "person"].includes(type) || !winner_id || !loser_id) {
    return new Response(JSON.stringify({ error: "Invalid parameters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (winner_id === loser_id) {
    return new Response(JSON.stringify({ error: "winner_id and loser_id must differ" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (type === "finding") {
      await mergeFinding(admin, winner_id, loser_id);
    } else {
      await mergePerson(admin, winner_id, loser_id);
    }

    // Record the merge
    await admin.from("duplicate_merges").insert({
      type,
      winner_id,
      loser_id,
      merged_by: userId,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("merge-duplicate error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function mergeFinding(
  admin: ReturnType<typeof createClient>,
  winner_id: string,
  loser_id: string,
) {
  // Fetch existing winner source URLs to skip conflicts
  const { data: winnerSources } = await admin
    .from("sources")
    .select("url")
    .eq("finding_id", winner_id);
  const winnerSourceUrls = new Set((winnerSources ?? []).map((s: { url: string }) => s.url));

  // Fetch loser sources, filter out URL conflicts
  const { data: loserSources } = await admin
    .from("sources")
    .select("id, url")
    .eq("finding_id", loser_id);

  const sourcesToMove = (loserSources ?? []).filter(
    (s: { id: string; url: string }) => !winnerSourceUrls.has(s.url)
  );
  if (sourcesToMove.length > 0) {
    const ids = sourcesToMove.map((s: { id: string }) => s.id);
    await admin.from("sources").update({ finding_id: winner_id }).in("id", ids);
  }

  // Reassign finding_people — skip person_id conflicts
  const { data: winnerFP } = await admin
    .from("finding_people")
    .select("person_id")
    .eq("finding_id", winner_id);
  const winnerPersonIds = new Set((winnerFP ?? []).map((fp: { person_id: string }) => fp.person_id));

  const { data: loserFP } = await admin
    .from("finding_people")
    .select("id, person_id")
    .eq("finding_id", loser_id);

  const fpToMove = (loserFP ?? []).filter(
    (fp: { id: string; person_id: string }) => !winnerPersonIds.has(fp.person_id)
  );
  if (fpToMove.length > 0) {
    const ids = fpToMove.map((fp: { id: string }) => fp.id);
    await admin.from("finding_people").update({ finding_id: winner_id }).in("id", ids);
  }

  // Reassign reactions (no unique constraint, move all)
  await admin.from("reactions").update({ finding_id: winner_id }).eq("finding_id", loser_id);

  // Reassign finding_comments
  await admin.from("finding_comments").update({ finding_id: winner_id }).eq("finding_id", loser_id);

  // Delete loser (cascades remaining)
  await admin.from("findings").delete().eq("id", loser_id);
}

async function mergePerson(
  admin: ReturnType<typeof createClient>,
  winner_id: string,
  loser_id: string,
) {
  // Reassign finding_people — skip finding_id conflicts
  const { data: winnerFP } = await admin
    .from("finding_people")
    .select("finding_id")
    .eq("person_id", winner_id);
  const winnerFindingIds = new Set(
    (winnerFP ?? []).map((fp: { finding_id: string }) => fp.finding_id)
  );

  const { data: loserFP } = await admin
    .from("finding_people")
    .select("id, finding_id")
    .eq("person_id", loser_id);

  const fpToMove = (loserFP ?? []).filter(
    (fp: { id: string; finding_id: string }) => !winnerFindingIds.has(fp.finding_id)
  );
  if (fpToMove.length > 0) {
    const ids = fpToMove.map((fp: { id: string }) => fp.id);
    await admin.from("finding_people").update({ person_id: winner_id }).in("id", ids);
  }

  // Reassign person_relationships person_a_id
  const { data: relA } = await admin
    .from("person_relationships")
    .select("id, person_b_id")
    .eq("person_a_id", loser_id);

  // Get existing winner relationships to avoid duplicates
  const { data: winnerRelA } = await admin
    .from("person_relationships")
    .select("person_b_id")
    .eq("person_a_id", winner_id);
  const winnerBIds = new Set((winnerRelA ?? []).map((r: { person_b_id: string }) => r.person_b_id));

  const relAToMove = (relA ?? []).filter(
    (r: { id: string; person_b_id: string }) =>
      r.person_b_id !== winner_id && !winnerBIds.has(r.person_b_id)
  );
  if (relAToMove.length > 0) {
    const ids = relAToMove.map((r: { id: string }) => r.id);
    await admin.from("person_relationships").update({ person_a_id: winner_id }).in("id", ids);
  }

  // Reassign person_relationships person_b_id
  const { data: relB } = await admin
    .from("person_relationships")
    .select("id, person_a_id")
    .eq("person_b_id", loser_id);

  const { data: winnerRelB } = await admin
    .from("person_relationships")
    .select("person_a_id")
    .eq("person_b_id", winner_id);
  const winnerAIds = new Set((winnerRelB ?? []).map((r: { person_a_id: string }) => r.person_a_id));

  const relBToMove = (relB ?? []).filter(
    (r: { id: string; person_a_id: string }) =>
      r.person_a_id !== winner_id && !winnerAIds.has(r.person_a_id)
  );
  if (relBToMove.length > 0) {
    const ids = relBToMove.map((r: { id: string }) => r.id);
    await admin.from("person_relationships").update({ person_b_id: winner_id }).in("id", ids);
  }

  // Merge politicians row if loser has one
  const { data: loserPol } = await admin
    .from("politicians")
    .select("*")
    .eq("person_id", loser_id)
    .maybeSingle();

  if (loserPol) {
    const { data: winnerPol } = await admin
      .from("politicians")
      .select("*")
      .eq("person_id", winner_id)
      .maybeSingle();

    if (winnerPol) {
      // Upsert winner with non-null fields from loser
      const merged: Record<string, unknown> = {};
      const fields = [
        "political_position", "political_party", "tenure_start", "tenure_end",
        "photo_url", "photo_source_url", "photo_source_name",
      ];
      for (const f of fields) {
        if (!winnerPol[f] && loserPol[f]) merged[f] = loserPol[f];
      }
      if (Object.keys(merged).length > 0) {
        await admin.from("politicians").update(merged).eq("person_id", winner_id);
      }
      await admin.from("politicians").delete().eq("person_id", loser_id);
    } else {
      // Reassign loser's politician row to winner
      await admin.from("politicians").update({ person_id: winner_id }).eq("person_id", loser_id);
    }
  }

  // Delete loser person (cascades remaining)
  await admin.from("people").delete().eq("id", loser_id);
}
