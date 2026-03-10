import type { Finding, Politician } from '../types';

const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'por', 'con', 'del', 'los', 'las',
  'un', 'una', 'se', 'que', 'su', 'al', 'es', 'lo', 'le', 'no', 'si',
  'más', 'pero', 'fue', 'ha', 'son', 'para', 'como', 'este', 'esta',
  'the', 'of', 'and', 'in', 'for', 'to', 'a', 'an', 'is', 'was', 'are',
  'were', 'be', 'been', 'by', 'or', 'at', 'on', 'with', 'from', 'that',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-záéíóúüñ\s]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const t of a) if (b.has(t)) count++;
  return count;
}

export interface FindingScore {
  titleScore: number;
  summaryScore: number;
  total: number;
}

export interface PersonScore {
  nameScore: number;
  positionScore: number;
  partyScore: number;
  total: number;
}

export const FINDING_THRESHOLD = 5;
export const PERSON_THRESHOLD = 3;

export function scoreFinding(a: Finding, b: Finding): FindingScore {
  const titleScore = overlap(tokenize(a.title), tokenize(b.title));
  const summaryScore = overlap(tokenize(a.summary ?? ''), tokenize(b.summary ?? ''));
  return { titleScore, summaryScore, total: titleScore + summaryScore };
}

export function scorePerson(a: Politician, b: Politician): PersonScore {
  const nameScore = overlap(
    tokenize(a.person?.name ?? ''),
    tokenize(b.person?.name ?? '')
  );
  const positionScore = overlap(
    tokenize(a.political_position ?? ''),
    tokenize(b.political_position ?? '')
  );
  const partyScore = overlap(
    tokenize(a.political_party ?? ''),
    tokenize(b.political_party ?? '')
  );
  return { nameScore, positionScore, partyScore, total: nameScore + positionScore + partyScore };
}
