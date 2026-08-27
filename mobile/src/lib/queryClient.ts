import { QueryClient, type FetchQueryOptions, type QueryKey } from "@tanstack/react-query";
import type { AxiosError } from "axios";

/**
 * A 4xx means the request itself is wrong (bad params, not found, still
 * unauthenticated after apiClient's own refresh-and-retry) — retrying the
 * exact same request cannot succeed, it can only add a few seconds of visible
 * loading/retry churn before the same error lands anyway. Only retry on
 * network failures or 5xx, where the server or connection may recover.
 */
export const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= 2) return false;
  const status = (error as AxiosError)?.response?.status;
  return status === undefined || status >= 500;
};

/**
 * Exported so tests can build a client that behaves like the real one — a
 * test client left at the library default (`staleTime: 0`) silently passes
 * cases that the app's own 5-minute window would break.
 */
export const DEFAULT_STALE_TIME = 1000 * 60 * 5;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * `client.fetchQuery`, but guaranteed to actually hit the network.
 *
 * Plain `fetchQuery` HONORS `staleTime`: when the cached entry is still fresh
 * it resolves with that cached value and never calls `queryFn` at all. A
 * pull-to-refresh gesture is stating outright that the caller believes the
 * data is stale, which outranks any freshness heuristic — this is what a
 * refresh handler should call instead of a query's own `.refetch()` (which
 * always re-runs with the args the query was defined with, so it can't force
 * a bypass on its own).
 *
 * Takes the client as an argument rather than closing over the singleton
 * above: a caller inside a component holds the one from `useQueryClient()`,
 * which is the singleton in the app but a per-test client under a test's own
 * QueryClientProvider. Reaching for the singleton here would write refreshed
 * data into a cache nothing is subscribed to.
 */
export function forceFetchQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  client: QueryClient,
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): Promise<TData> {
  return client.fetchQuery({ ...options, staleTime: 0 });
}
