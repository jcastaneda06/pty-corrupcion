import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { type Finding, type Person, type PersonRelationship } from '../types';

async function fetchFinding(id: string): Promise<Finding> {
  const { data, error } = await supabase
    .from('findings')
    .select(`
      *,
      people:finding_people(
        *,
        person:people(*)
      ),
      sources(*),
      reactions(*),
      finding_comments(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Finding;
}

async function fetchPersonWithFindings(id: string): Promise<Person> {
  const { data, error } = await supabase
    .from('people')
    .select(`
      *,
      findings:finding_people(
        *,
        finding:findings(*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Person;
}

async function fetchRelationshipsForFinding(findingId: string): Promise<PersonRelationship[]> {
  // Get all person IDs in this finding
  const { data: fp, error: fpError } = await supabase
    .from('finding_people')
    .select('person_id')
    .eq('finding_id', findingId);

  if (fpError) throw fpError;
  const personIds = (fp ?? []).map((r: { person_id: string }) => r.person_id);

  if (personIds.length === 0) return [];

  // Get relationships where both parties are in this finding
  const { data, error } = await supabase
    .from('person_relationships')
    .select(`
      *,
      person_a:people!person_relationships_person_a_id_fkey(*),
      person_b:people!person_relationships_person_b_id_fkey(*)
    `)
    .or(`person_a_id.in.(${personIds.join(',')}),person_b_id.in.(${personIds.join(',')})`)

  if (error) throw error;
  return data as PersonRelationship[];
}

export function useFinding(id: string) {
  return useQuery({
    queryKey: ['finding', id],
    queryFn: () => fetchFinding(id),
    enabled: !!id,
  });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: () => fetchPersonWithFindings(id),
    enabled: !!id,
  });
}

export function useFindingRelationships(findingId: string) {
  return useQuery({
    queryKey: ['finding-relationships', findingId],
    queryFn: () => fetchRelationshipsForFinding(findingId),
    enabled: !!findingId,
  });
}
