import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canEnterTeams } from '../auth/activeTeam';
import { settleAutosave } from '../pages/admin-progetti/useAutosave';

/** Dalle pagine Tutti i Team entra in un team (sola lettura per il manager) e apre `to`.
 *  Stesso flusso del cambio team dal menu: prima salva le modifiche in coda.
 *  `null` per il manager puro: non entra nei singoli team, i badge restano testo. */
export function useEnterTeam(): ((teamId: number, to: string) => Promise<void>) | null {
  const { account, selectTeam } = useAuth();
  const navigate = useNavigate();
  const enterTeam = useCallback(async (teamId: number, to: string) => {
    const saved = await settleAutosave();
    if (!saved && !window.confirm('Ci sono modifiche non salvate: cambiando team andranno perse. Continuare?')) return;
    selectTeam(teamId);
    navigate(to);
  }, [selectTeam, navigate]);
  return account != null && canEnterTeams(account) ? enterTeam : null;
}
