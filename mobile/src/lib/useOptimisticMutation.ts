import { QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";

interface OptimisticMutationOptions<TData, TVars> {
  /**
   * Fixed for a hook scoped to one cache entry. A function when the target
   * varies per call — e.g. toggling one item in a list that spans several
   * cache entries, not just one fixed entry.
   */
  queryKey: QueryKey | ((vars: TVars) => QueryKey);
  mutationFn: (vars: TVars) => Promise<unknown>;
  /** Computes the cache's new value immediately, before the network call resolves. */
  optimisticUpdate: (previous: TData | undefined, vars: TVars) => TData;
  /**
   * Other cache entries this mutation affects but doesn't itself own — e.g. an
   * aggregate/summary query this hook has no optimistic value for. Invalidated
   * (not optimistically written) on settle alongside the primary key, so they
   * refetch to the server's real state instead of going stale silently.
   */
  invalidateKeys?: (vars: TVars) => QueryKey[];
}

/**
 * Immediately overwrites the target query's cached data via `optimisticUpdate`
 * so the UI reflects the change before the request resolves, rolls back to
 * the pre-mutation snapshot on failure, and refetches on settle either way so
 * the cache converges on the server's actual state.
 */
export function useOptimisticMutation<TData, TVars>({
  queryKey,
  mutationFn,
  optimisticUpdate,
  invalidateKeys,
}: OptimisticMutationOptions<TData, TVars>) {
  const queryClient = useQueryClient();
  const resolveKey = (vars: TVars): QueryKey =>
    typeof queryKey === "function" ? (queryKey as (vars: TVars) => QueryKey)(vars) : queryKey;

  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      const key = resolveKey(vars);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TData>(key);
      queryClient.setQueryData<TData>(key, optimisticUpdate(previous, vars));
      return { previous, key };
    },
    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: resolveKey(vars) });
      for (const key of invalidateKeys?.(vars) ?? []) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
