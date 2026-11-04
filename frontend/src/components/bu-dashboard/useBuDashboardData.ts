import { useCallback, useEffect, useState } from 'react';
import { getBuEfficiency, getBuInvestment, getBuPeople } from '@/api';
import type { BuEfficiency, BuInvestmentRow, BuPerson } from '@/types';
import { mondayOf } from '@/lib/buModel';

/** Finestra della sezione Disponibilità: sempre le prossime 4 settimane, dal lunedì corrente. */
export const AVAILABILITY_WEEKS = 4;

const LOAD_ERROR = 'Dati non disponibili.';

export interface BuSource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface SourceState<T> {
  /** Chiave delle deps a cui appartiene lo stato: con deps diverse nulla è ancora caricato. */
  key: string;
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Una fonte, un ciclo di vita: un errore non blocca le altre fonti. Le risposte di periodi superati vengono scartate.
 * Cambiando `deps` i dati precedenti non vengono esposti; un `reload()` a parità di deps mantiene i dati mostrati.
 */
function useBuSource<T>(load: () => Promise<T>, deps: readonly unknown[]): BuSource<T> {
  const depsKey = JSON.stringify(deps);
  const [state, setState] = useState<SourceState<T>>({ key: depsKey, data: null, loading: true, error: null });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(current => current + 1), []);

  useEffect(() => {
    let alive = true;
    setState(previous => ({
      key: depsKey,
      data: previous.key === depsKey ? previous.data : null,
      loading: true,
      error: null,
    }));
    load()
      .then(next => { if (alive) setState({ key: depsKey, data: next, loading: false, error: null }); })
      .catch(() => {
        if (alive) setState(previous => ({
          key: depsKey,
          data: previous.key === depsKey ? previous.data : null,
          loading: false,
          error: LOAD_ERROR,
        }));
      });
    return () => { alive = false; };
    // `load` è una closure sui soli `deps` (serializzati in `depsKey`) e il ricarico passa da `version`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, depsKey]);

  // Stato di un'altra chiave (cambio periodo, prima del caricamento): nessun dato vecchio sotto la nuova etichetta.
  const current = state.key === depsKey
    ? state
    : { key: depsKey, data: null, loading: true, error: null };
  return { data: current.data, loading: current.loading, error: current.error, reload };
}

/** Disponibilità (sempre 4 settimane), investimento ed efficienza: ognuna con stato proprio. */
export function useBuDashboardData(period: { from: string; to: string }): {
  people: BuSource<BuPerson[]>;
  investment: BuSource<BuInvestmentRow[]>;
  efficiency: BuSource<BuEfficiency>;
} {
  const people = useBuSource(() => getBuPeople(mondayOf(new Date()), AVAILABILITY_WEEKS), []);
  const investment = useBuSource(() => getBuInvestment(period.from, period.to), [period.from, period.to]);
  const efficiency = useBuSource(() => getBuEfficiency(period.from, period.to), [period.from, period.to]);
  return { people, investment, efficiency };
}
