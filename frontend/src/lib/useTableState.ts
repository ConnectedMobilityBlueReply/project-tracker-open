import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TableDirection = 'asc' | 'desc';

export interface TableStateOptions {
  defaultQuery?: string;
  defaultSort?: string | null;
  defaultDirection?: TableDirection;
  defaultPage?: number;
}

export interface TableState {
  query: string;
  sort: string | null;
  direction: TableDirection;
  page: number;
  setQuery(query: string): void;
  setSort(sort: string | null, direction?: TableDirection): void;
  setPage(page: number): void;
  reset(): void;
}

function positivePage(value: string | null, fallback: number): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : fallback;
}

export function useTableState(options: TableStateOptions = {}): TableState {
  const {
    defaultQuery = '',
    defaultSort = null,
    defaultDirection = 'asc',
    defaultPage = 1,
  } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => {
    const rawDirection = searchParams.get('dir');
    return {
      query: searchParams.get('q') ?? defaultQuery,
      sort: searchParams.get('sort') ?? defaultSort,
      direction: rawDirection === 'desc' ? 'desc' as const : defaultDirection,
      page: positivePage(searchParams.get('page'), defaultPage),
    };
  }, [defaultDirection, defaultPage, defaultQuery, defaultSort, searchParams]);

  const update = useCallback((mutate: (params: URLSearchParams) => void) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      mutate(next);
      return next;
    });
  }, [setSearchParams]);

  const setQuery = useCallback((query: string) => {
    update(params => {
      if (query.trim()) params.set('q', query);
      else params.delete('q');
      params.delete('page');
    });
  }, [update]);

  const setSort = useCallback((sort: string | null, direction = 'asc' as TableDirection) => {
    update(params => {
      if (sort) {
        params.set('sort', sort);
        params.set('dir', direction);
      } else {
        params.delete('sort');
        params.delete('dir');
      }
      params.delete('page');
    });
  }, [update]);

  const setPage = useCallback((page: number) => {
    update(params => {
      if (page > 1) params.set('page', String(Math.max(1, Math.floor(page))));
      else params.delete('page');
    });
  }, [update]);

  const reset = useCallback(() => {
    update(params => {
      params.delete('q');
      params.delete('sort');
      params.delete('dir');
      params.delete('page');
    });
  }, [update]);

  return { ...state, setQuery, setSort, setPage, reset };
}
