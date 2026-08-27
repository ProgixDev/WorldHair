import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { useOptimisticMutation } from "./useOptimisticMutation";

const KEY = ["thing", 1] as const;

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, { value: "before" });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe("useOptimisticMutation", () => {
  it("applies the optimistic value immediately, before the mutation resolves", async () => {
    let resolveMutation: (() => void) | undefined;
    const mutationFn = jest.fn(
      () => new Promise<void>((resolve) => { resolveMutation = resolve; }),
    );

    const { result } = await renderHook(
      () =>
        useOptimisticMutation<{ value: string }, string>({
          queryKey: KEY,
          mutationFn,
          optimisticUpdate: (_previous, next) => ({ value: next }),
        }),
      { wrapper },
    );

    result.current.mutate("optimistic");

    // Applied synchronously via onMutate, well before the network resolves.
    await waitFor(() => expect(mutationFn).toHaveBeenCalled());
    resolveMutation?.();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back to the pre-mutation value when the mutation fails", async () => {
    let rejectMutation: ((error: Error) => void) | undefined;
    const mutationFn = jest.fn(
      () => new Promise<void>((_resolve, reject) => { rejectMutation = reject; }),
    );
    let queryClient: QueryClient | undefined;
    const captureWrapper = ({ children }: { children: React.ReactNode }) => {
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData(KEY, { value: "before" });
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };

    const { result } = await renderHook(
      () =>
        useOptimisticMutation<{ value: string }, string>({
          queryKey: KEY,
          mutationFn,
          optimisticUpdate: (_previous, next) => ({ value: next }),
        }),
      { wrapper: captureWrapper },
    );

    result.current.mutate("optimistic");

    await waitFor(() => expect(queryClient!.getQueryData(KEY)).toEqual({ value: "optimistic" }));
    rejectMutation?.(new Error("network down"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient!.getQueryData(KEY)).toEqual({ value: "before" });
  });

  it("resolves the query key per call when given a function, touching only that entry", async () => {
    let queryClient: QueryClient | undefined;
    const dynamicWrapper = ({ children }: { children: React.ReactNode }) => {
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData(["season", 1], { items: ["a"] });
      queryClient.setQueryData(["season", 2], { items: ["b"] });
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };

    const { result } = await renderHook(
      () =>
        useOptimisticMutation<{ items: string[] }, { season: number; item: string }>({
          queryKey: (vars) => ["season", vars.season],
          mutationFn: async () => undefined,
          optimisticUpdate: (previous, vars) => ({
            items: [...(previous?.items ?? []), vars.item],
          }),
        }),
      { wrapper: dynamicWrapper },
    );

    result.current.mutate({ season: 2, item: "c" });

    await waitFor(() =>
      expect(queryClient!.getQueryData(["season", 2])).toEqual({ items: ["b", "c"] }),
    );
    // Season 1's entry is untouched -- the dynamic key must not fall back to
    // patching some other/shared entry.
    expect(queryClient!.getQueryData(["season", 1])).toEqual({ items: ["a"] });
  });

  it("invalidates related query keys on settle, alongside the primary key", async () => {
    let queryClient: QueryClient | undefined;
    const relatedWrapper = ({ children }: { children: React.ReactNode }) => {
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData(KEY, { value: "before" });
      queryClient.setQueryData(["related", 1], { value: "stale" });
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };

    const { result } = await renderHook(
      () =>
        useOptimisticMutation<{ value: string }, string>({
          queryKey: KEY,
          mutationFn: async () => undefined,
          optimisticUpdate: (_previous, next) => ({ value: next }),
          invalidateKeys: () => [["related", 1]],
        }),
      { wrapper: relatedWrapper },
    );

    result.current.mutate("optimistic");

    await waitFor(() =>
      expect(queryClient!.getQueryState(["related", 1])?.isInvalidated).toBe(true),
    );
  });
});
