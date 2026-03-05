import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export function useComments() {
  return useQuery({
    queryKey: ['comments'],
    queryFn: async (): Promise<Comment[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Comment[];
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ author, content }: { author: string; content: string }) => {
      const { error } = await supabase.from('comments').insert({ author, content });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
