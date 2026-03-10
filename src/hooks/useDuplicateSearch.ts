import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Finding, Politician } from '../types';

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function useAllFindings(enabled: boolean) {
  return useQuery({
    queryKey: ['search-findings-all'],
    queryFn: async (): Promise<Finding[]> => {
      const { data, error } = await supabase
        .from('findings')
        .select('*, sources(*), people:finding_people(*, person:people(*))')
        .order('date_reported', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Finding[];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useSearchFindings(query: string) {
  const trimmed = query.trim();
  const { data: all = [], isFetching } = useAllFindings(trimmed.length > 1);
  const normalized = normalizeText(trimmed);
  const data = trimmed.length > 1
    ? all.filter((f) => normalizeText(f.title).includes(normalized)).slice(0, 20)
    : [];
  return { data, isFetching };
}

export function useSearchPoliticians(query: string) {
  return useQuery({
    queryKey: ['search-politicians', query],
    queryFn: async (): Promise<Politician[]> => {
      if (!query.trim()) return [];
      const { data, error } = await supabase.rpc('search_politicians_by_name', {
        search_query: query.trim(),
      });
      if (error) throw error;
      return (data ?? []) as Politician[];
    },
    enabled: query.trim().length > 1,
    staleTime: 30_000,
  });
}

export function useMergeDuplicate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      type,
      winner_id,
      loser_id,
    }: {
      type: 'finding' | 'person';
      winner_id: string;
      loser_id: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('merge-duplicate', {
        body: { type, winner_id, loser_id },
      });
      if (error) throw new Error(error.message ?? 'Error al fusionar');
    },
    onSuccess: (_data, variables) => {
      if (variables.type === 'finding') {
        queryClient.invalidateQueries({ queryKey: ['findings'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['finding', variables.loser_id] });
        queryClient.invalidateQueries({ queryKey: ['finding', variables.winner_id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['politicians'] });
        queryClient.invalidateQueries({ queryKey: ['politician-timeline'] });
      }
    },
  });
}
