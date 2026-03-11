import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { type Politician, type PoliticianFilters, type FindingPerson } from "../types";

async function fetchPoliticians(filters: PoliticianFilters = {}): Promise<Politician[]> {
  let query = supabase
    .from("politicians")
    .select("*, person:people!person_id(*)")
    .not("political_position", "is", null)
    .is("deleted_at", null);

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

export interface PoliticianEditData {
  name: string;
  political_position: string;
  political_party: string;
  tenure_start: string;
  tenure_end: string;
  photo_url: string;
  photo_source_url: string;
  photo_source_name: string;
}

export function useUpdatePolitician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ politician, data }: { politician: Politician; data: PoliticianEditData }) => {
      if (data.name !== politician.person?.name) {
        const { error } = await supabase
          .from("people")
          .update({ name: data.name })
          .eq("id", politician.person_id);
        if (error) throw error;
      }

      const { error } = await supabase
        .from("politicians")
        .update({
          political_position: data.political_position || null,
          political_party: data.political_party || null,
          tenure_start: data.tenure_start ? `${data.tenure_start}-01-01` : null,
          tenure_end: data.tenure_end ? `${data.tenure_end}-12-31` : null,
          photo_url: data.photo_url || null,
          photo_source_url: data.photo_source_url || null,
          photo_source_name: data.photo_source_name || null,
        })
        .eq("person_id", politician.person_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["politicians"] });
    },
  });
}

export function useDeletePolitician() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (personId: string) => {
      const { error } = await supabase
        .from("politicians")
        .update({ deleted_at: new Date().toISOString() })
        .eq("person_id", personId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["politicians"] });
    },
  });
}

export function usePoliticianTimeline(personId: string | null) {
  return useQuery({
    queryKey: ["politician-timeline", personId],
    queryFn: () => fetchPoliticianTimeline(personId!),
    enabled: !!personId,
  });
}
