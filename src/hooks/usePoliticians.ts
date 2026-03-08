import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { type Politician, type PoliticianFilters, type FindingPerson } from "../types";

async function fetchPoliticians(filters: PoliticianFilters = {}): Promise<Politician[]> {
  let query = supabase
    .from("politicians")
    .select(`
      *,
      person:people(*),
      finding_count:finding_people(count)
    `)
    .eq("is_processed", true)
    .not("political_position", "is", null);

  if (filters.search) {
    query = query.ilike("person.name", `%${filters.search}%`);
  }
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

  return (data ?? []).map((row) => ({
    ...row,
    finding_count: (row.finding_count as { count: number }[])?.[0]?.count ?? 0,
  })) as Politician[];
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
