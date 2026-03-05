import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useAddFindingComment(findingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      user_id,
      author_name,
      author_email,
      content,
    }: {
      user_id: string;
      author_name: string;
      author_email: string;
      content: string;
    }) => {
      const { error } = await supabase
        .from('finding_comments')
        .insert({ finding_id: findingId, user_id, author_name, author_email, content });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finding', findingId] });
    },
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      findingId,
      emoji,
      userId,
    }: {
      findingId: string;
      emoji: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('reactions')
        .insert({ finding_id: findingId, emoji, user_id: userId });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['finding', variables.findingId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
    },
  });
}

export function useRemoveReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      findingId,
      emoji,
      userId,
    }: {
      findingId: string;
      emoji: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('finding_id', findingId)
        .eq('emoji', emoji)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['finding', variables.findingId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
    },
  });
}
