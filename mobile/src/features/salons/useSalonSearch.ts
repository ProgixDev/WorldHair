import { useCallback, useEffect, useRef, useState } from "react";
import { searchSalons } from "./api";
import type { SalonFilters } from "./filters";
import type { Coordinates } from "./geo";
import type { Salon } from "./types";

const PAGE_SIZE = 20;
/** Typing waits this long before asking the server. */
const DEBOUNCE_MS = 300;

interface SearchState {
  items: Salon[];
  /** Every match, beyond the pages loaded. */
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

/**
 * The search list's pages (TODO.md Phase 6): the first on every change of
 * filters or position, the next ones as the list scrolls. An answer to an
 * older request never replaces a newer one.
 */
export function useSalonSearch(filters: SalonFilters, from: Coordinates) {
  const [state, setState] = useState<SearchState>({ items: [], total: 0, loading: true, loadingMore: false, error: null });
  const latest = useRef(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = ++latest.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    const timer = setTimeout(() => {
      searchSalons(filters, from, { limit: PAGE_SIZE, offset: 0 })
        .then((page) => {
          if (latest.current === request) {
            setState({ items: page.items, total: page.total, loading: false, loadingMore: false, error: null });
          }
        })
        .catch(() => {
          if (latest.current === request) {
            setState((current) => ({ ...current, loading: false, error: "Impossible de charger les salons. Réessayez." }));
          }
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters, from, attempt]);

  const loadMore = useCallback(() => {
    if (state.loading || state.loadingMore || state.items.length >= state.total) return;
    const request = latest.current;
    const offset = state.items.length;
    setState((current) => ({ ...current, loadingMore: true }));
    searchSalons(filters, from, { limit: PAGE_SIZE, offset })
      .then((page) => {
        if (latest.current !== request) return;
        setState((current) => ({
          ...current,
          items: [...current.items, ...page.items.filter((item) => !current.items.some((known) => known.id === item.id))],
          total: page.total,
          loadingMore: false,
        }));
      })
      .catch(() => {
        if (latest.current === request) setState((current) => ({ ...current, loadingMore: false }));
      });
  }, [filters, from, state.items, state.loading, state.loadingMore, state.total]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { ...state, loadMore, retry };
}
