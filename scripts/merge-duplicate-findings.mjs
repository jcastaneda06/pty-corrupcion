#!/usr/bin/env node
/**
 * merge-duplicate-findings.mjs
 *
 * One-time script that clusters existing findings by topic and merges duplicates.
 * For each cluster of findings about the same case:
 *   - Picks a winner (highest severity; most sources as tiebreaker)
 *   - Asks Claude to write a consolidated summary
 *   - Reassigns all sources and people from losers → winner
 *   - Deletes the losing findings
 *
 * Usage:
 *   node scripts/merge-duplicate-findings.mjs [--dry-run]
 *
 * Required env vars (export or put in .env):
 *   SUPABASE_URL               — from Supabase dashboard → Settings → API
 *   SUPABASE_SERVICE_ROLE_KEY  — from Supabase dashboard → Settings → API
 *   ANTHROPIC_API_KEY          — your Anthropic API key
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Load .env ─────────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
  console.error(`
Missing required environment variables. Export them or add to .env:
  SUPABASE_URL              (Supabase dashboard → Settings → API → Project URL)
  SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Settings → API → service_role secret)
  ANTHROPIC_API_KEY
`);
  process.exit(1);
}

if (DRY_RUN) console.log('Running in DRY-RUN mode — no changes will be made.\n');

// ── Severity ranking ──────────────────────────────────────────────────────────

const SEVERITY_RANK = { critico: 4, alto: 3, medio: 2, bajo: 1 };

// ── Claude helper ─────────────────────────────────────────────────────────────

async function claude(prompt, maxTokens = 4096) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = data.content[0];
  if (block.type !== 'text') throw new Error('No text block from Claude');
  return block.text.trim();
}

// ── Step 1: cluster all findings into topic groups ────────────────────────────

async function clusterFindings(findings) {
  const itemList = findings
    .map((f, i) => `[${i}] ${f.title} — ${f.summary.slice(0, 150)}`)
    .join('\n');

  const raw = await claude(`Agrupa los siguientes hallazgos de corrupción por caso/evento específico. Hallazgos sobre el mismo escándalo, persona imputada o contrato van juntos. Hallazgos sobre casos distintos van separados aunque compartan el mismo tema general.

${itemList}

Responde ÚNICAMENTE con JSON válido (sin markdown):
{"groups":[[0,3,7],[1,2],[4],[5,6],...]}

Todo índice del 0 al ${findings.length - 1} debe aparecer exactamente una vez.`);

  // Extract the JSON object using brace-counting so extra text after the closing }
  // (e.g. Claude adding an explanation) doesn't break the parse.
  const start = raw.indexOf('{"groups"');
  if (start === -1) throw new Error(`No {"groups" key found in Claude response:\n${raw}`);
  let depth = 0, end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('Unmatched braces in Claude response');
  const { groups } = JSON.parse(raw.slice(start, end + 1));

  // Validate — every index must appear exactly once
  const seen = new Set();
  const result = [];
  for (const group of groups) {
    const valid = group.filter(i => Number.isInteger(i) && i >= 0 && i < findings.length && !seen.has(i));
    valid.forEach(i => seen.add(i));
    if (valid.length > 0) result.push(valid.map(i => findings[i]));
  }
  // Add any Claude missed
  for (let i = 0; i < findings.length; i++) {
    if (!seen.has(i)) result.push([findings[i]]);
  }
  return result;
}

// ── Step 2: generate a consolidated summary for a merged group ────────────────

async function mergedSummary(group) {
  const content = group
    .map(f => `TÍTULO: ${f.title}\nRESUMEN: ${f.summary}`)
    .join('\n\n---\n\n');

  return await claude(`Los siguientes hallazgos tratan del mismo caso de corrupción. Escribe un resumen consolidado de 2-4 oraciones que capture toda la información relevante. Responde ÚNICAMENTE con el texto del resumen, sin comillas ni explicaciones.\n\n${content}`, 512);
}

// ── Step 3: merge a group into its winner finding ────────────────────────────

async function mergeGroup(supabase, group, sourceCountById) {
  // Winner = highest severity; tiebreak by most sources
  const winner = group.reduce((best, curr) => {
    const br = SEVERITY_RANK[best.severity] ?? 0;
    const cr = SEVERITY_RANK[curr.severity] ?? 0;
    if (cr > br) return curr;
    if (cr === br && (sourceCountById[curr.id] ?? 0) > (sourceCountById[best.id] ?? 0)) return curr;
    return best;
  });
  const losers = group.filter(f => f.id !== winner.id);

  console.log(`\n  Winner : "${winner.title}" (${winner.severity})`);
  losers.forEach(l => console.log(`  Merging: "${l.title}" (${l.severity})`));

  if (DRY_RUN) return;

  // Consolidated summary
  const summary = await mergedSummary(group);

  // Merged fields: max amount (same case ≠ additive), earliest date
  const amount_usd = group.some(f => f.amount_usd != null)
    ? Math.max(...group.map(f => f.amount_usd ?? 0))
    : null;
  const date_occurred = group
    .map(f => f.date_occurred)
    .filter(Boolean)
    .sort()[0] ?? null;

  await supabase.from('findings').update({ summary, amount_usd, date_occurred }).eq('id', winner.id);

  for (const loser of losers) {
    // Move sources (skip URL conflicts)
    const { data: loserSources } = await supabase.from('sources').select('*').eq('finding_id', loser.id);
    for (const src of loserSources ?? []) {
      const { data: clash } = await supabase
        .from('sources').select('id').eq('finding_id', winner.id).eq('url', src.url).limit(1);
      if (clash?.length) {
        await supabase.from('sources').delete().eq('id', src.id);
      } else {
        await supabase.from('sources').update({ finding_id: winner.id }).eq('id', src.id);
      }
    }

    // Move finding_people (skip person conflicts — keep winner's row)
    const { data: fps } = await supabase.from('finding_people').select('*').eq('finding_id', loser.id);
    for (const fp of fps ?? []) {
      const { data: clash } = await supabase
        .from('finding_people').select('person_id')
        .eq('finding_id', winner.id).eq('person_id', fp.person_id).limit(1);
      if (clash?.length) {
        await supabase.from('finding_people').delete()
          .eq('finding_id', loser.id).eq('person_id', fp.person_id);
      } else {
        await supabase.from('finding_people').update({ finding_id: winner.id })
          .eq('finding_id', loser.id).eq('person_id', fp.person_id);
      }
    }

    // Delete loser finding
    await supabase.from('findings').delete().eq('id', loser.id);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Fetching all findings…');
  const { data: findings, error } = await supabase
    .from('findings')
    .select('id, title, summary, severity, category, amount_usd, date_occurred, source_url')
    .order('date_occurred', { ascending: true });
  if (error) throw new Error(`Failed to fetch findings: ${error.message}`);
  if (!findings?.length) { console.log('No findings found.'); return; }
  console.log(`${findings.length} findings fetched.`);

  // Pre-fetch source counts per finding for tiebreaking
  const { data: sourceCounts } = await supabase
    .from('sources')
    .select('finding_id');
  const sourceCountById = {};
  for (const { finding_id } of sourceCounts ?? []) {
    sourceCountById[finding_id] = (sourceCountById[finding_id] ?? 0) + 1;
  }

  console.log('Clustering with Claude…');
  const groups = await clusterFindings(findings);
  const multiGroups = groups.filter(g => g.length > 1);
  const soloCount = groups.length - multiGroups.length;

  console.log(`Result: ${groups.length} groups total`);
  console.log(`  ${multiGroups.length} groups with duplicates to merge`);
  console.log(`  ${soloCount} unique findings (no action needed)`);

  if (multiGroups.length === 0) {
    console.log('\nNo duplicates found. Done.');
    return;
  }

  let merged = 0;
  let deleted = 0;

  for (let i = 0; i < multiGroups.length; i++) {
    const group = multiGroups[i];
    console.log(`\n[${i + 1}/${multiGroups.length}] Group of ${group.length}:`);
    await mergeGroup(supabase, group, sourceCountById);
    merged++;
    deleted += group.length - 1;
  }

  console.log(`\n${'─'.repeat(50)}`);
  if (DRY_RUN) {
    console.log(`DRY RUN complete. Would have merged ${merged} groups and deleted ${deleted} findings.`);
  } else {
    console.log(`Done. Merged ${merged} groups, deleted ${deleted} duplicate findings.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
