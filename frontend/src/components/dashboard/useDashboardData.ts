import { useCallback, useEffect, useState } from 'react';
import { getDashboardMonthly, getDashboardProjects, getDashboardWbsStatus, getProjects } from '@/api';
import type { DashboardMonthlyRow, DashboardProject, DashboardWbsStatus, Project } from '@/types';

export interface Source<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const LOAD_ERROR = 'Dati non disponibili.';

/** Una fonte, un ciclo di vita: se una richiesta fallisce, le altre card restano visibili. */
function useSource<T>(load: () => Promise<T>): Source<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    load()
      .then(next => { if (alive) setData(next); })
      .catch(() => { if (alive) setError(LOAD_ERROR); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // `load` è un riferimento stabile a una funzione di api.ts: il ricarico lo pilota `version`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return { data, loading, error, retry };
}

const loadMonthly = () => getDashboardMonthly(3);

export function useDashboardData() {
  const wbs = useSource<DashboardWbsStatus>(getDashboardWbsStatus);
  const monthly = useSource<DashboardMonthlyRow[]>(loadMonthly);
  const projects = useSource<DashboardProject[]>(getDashboardProjects);
  const listed = useSource<Project[]>(getProjects);
  return { wbs, monthly, projects, listed };
}
