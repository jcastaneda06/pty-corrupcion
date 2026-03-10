import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { type Politician, type PoliticianFilters, type FindingPerson } from "../types";

async function fetchPoliticians(filters: PoliticianFilters = {}): Promise<Politician[]> {
  let query = supabase
    .from("politicians")
    .select("*, person:people!person_id(*)")
    .not("political_position", "is", null);

  if (filters.position) {
    query = query.ilike("political_position", `%${filters.position}%`);
  }
  if (filters.dateFrom) {
    query = query.gte("tenure_start", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("tenure_end", filters.dateTo);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  let rows = (data ?? []) as Politician[];

  // Search filter applied client-side since PostgREST can't filter on embedded columns
  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter((p) => p.person?.name?.toLowerCase().includes(term));
  }

  if (rows.length === 0) return [];

  // Fetch finding counts for all returned politicians via finding_people.person_id
  const personIds = rows.map((p) => p.person_id);
  const { data: fpRows } = await supabase
    .from("finding_people")
    .select("person_id")
    .in("person_id", personIds);

  const countMap: Record<string, number> = {};
  for (const row of fpRows ?? []) {
    countMap[row.person_id] = (countMap[row.person_id] ?? 0) + 1;
  }

  return rows.map((p) => ({ ...p, finding_count: countMap[p.person_id] ?? 0 }));
}

async function fetchPoliticianTimeline(personId: string): Promise<FindingPerson[]> {
  const { data, error } = await supabase
    .from("finding_people")
    .select(`*, finding:findings(*)`)
    .eq("person_id", personId);

  if (error) throw error;

  const items = (data ?? []) as FindingPerson[];

  return items.sort((a, b) => {
    const dateA = a.finding?.date_occurred ?? a.finding?.date_reported ?? '';
    const dateB = b.finding?.date_occurred ?? b.finding?.date_reported ?? '';
    return dateB.localeCompare(dateA);
  });
}

export function useListPoliticians(filters: PoliticianFilters = {}) {
  return useQuery({
    queryKey: ["politicians", filters],
    queryFn: () => fetchPoliticians(filters),
  });
}

export function usePoliticianTimeline(personId: string | null) {
  return useQuery({
    queryKey: ["politician-timeline", personId],
    queryFn: () => fetchPoliticianTimeline(personId!),
    enabled: !!personId,
  });
}
