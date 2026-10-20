import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  acceptInvite as apiAcceptInvite,
  ApiError,
  declineInvite as apiDeclineInvite,
  getMyInvites as apiGetMyInvites,
  changePassword as apiChangePassword,
  createTeam as apiCreateTeam,
  getMe as apiGetMe,
  login as apiLogin,
  logout as apiLogout,
  setActiveTeamHeader,
  UNAUTHORIZED_EVENT,
} from '../api';
import type { AppRole, AuthAccount, AuthChangePasswordResponse, AuthLoginResponse, TeamInvite, TeamSummary, User } from '../types';
import {
  ACTIVE_TEAM_STORAGE_KEY, ALL_TEAMS_STORED_VALUE, canEnterTeams, canUseAllTeams, parseStoredTeamId, resolveActiveTeam,
  resolveAggregateMode, toUser,
} from './activeTeam';
import AuthLoading from './AuthLoading';
import { ALL_TEAMS_HEADER_VALUE, TEAM_ACCESS_EVENT } from './teamHeader';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  /** Utente nel team attivo; null se non autenticato o autenticato senza team (onboarding). */
  user: User | null;
  account: AuthAccount | null;
  teams: readonly TeamSummary[];
  /** Inviti a team ricevuti e non ancora accettati. */
  invites: readonly TeamInvite[];
  activeTeamId: number | null;
  /** Modalità Tutti i Team (manager e super-admin; per il manager puro è l'unica): dati di ogni team. */
  allTeams: boolean;
  /** Risolve con la risposta completa del backend: o una sessione
   *  autenticata (il contesto passa a `authenticated`), oppure una
   *  `session` temporanea per completare il cambio password di primo accesso. */
  login(email: string, password: string): Promise<AuthLoginResponse>;
  changePassword(email: string, session: string, newPassword: string): Promise<AuthChangePasswordResponse>;
  logout(): Promise<void>;
  selectTeam(teamId: number): void;
  selectAllTeams(): void;
  createTeam(name: string): Promise<TeamSummary>;
  reloadAccount(): Promise<void>;
  /** Accetta l'invito, ricarica l'account e attiva il team accettato. */
  acceptInvite(teamId: number, role: AppRole): Promise<void>;
  declineInvite(teamId: number): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredRaw(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredTeamId(): number | null {
  return parseStoredTeamId(readStoredRaw());
}

function storeSelection(value: string): void {
  try {
    window.localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, value);
  } catch {
    // Storage non disponibile: la scelta resta valida per la sessione corrente.
  }
}

function storeTeamId(teamId: number): void {
  storeSelection(String(teamId));
}

function clearStoredTeamId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
  } catch {
    // Storage non disponibile: niente da pulire.
  }
}

// Gli inviti sono accessori: un errore non deve far fallire login o caricamento dell'account.
async function fetchInvitesSafe(): Promise<TeamInvite[]> {
  try {
    return await apiGetMyInvites();
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [allTeams, setAllTeams] = useState(false);
  const [invites, setInvites] = useState<TeamInvite[]>([]);

  // L'header va impostato prima del render: la prima fetch di ogni pagina
  // deve già portare X-Team-Id.
  // `allTeamsPreference` assente: la modalità si ricava dalla scelta salvata (il manager parte in Tutti i Team).
  // Con Tutti i Team attivo l'header è 'all'; il team attivo resta solo stato del client.
  const applyAccount = useCallback((next: AuthAccount | null, preferredTeamId: number | null, allTeamsPreference?: boolean) => {
    const team = next ? resolveActiveTeam(next.teams, preferredTeamId) : null;
    const aggregate = next != null && team != null
      && resolveAggregateMode(next, allTeamsPreference ?? null, readStoredRaw());
    setActiveTeamHeader(aggregate ? ALL_TEAMS_HEADER_VALUE : (team?.id ?? null));
    if (aggregate) storeSelection(ALL_TEAMS_STORED_VALUE);
    else if (team) storeTeamId(team.id);
    setAllTeams(aggregate);
    setAccount(next);
    if (!next) setInvites([]);
    setActiveTeamId(team?.id ?? null);
    setStatus(next ? 'authenticated' : 'anonymous');
  }, []);

  // Single-flight: N richieste fallite in parallelo causano un solo getMe.
  // Team attivo in questa scheda: localStorage è condiviso tra le schede e può puntare a un altro team.
  const activeRef = useRef<number | null>(null);
  activeRef.current = activeTeamId;
  const allTeamsRef = useRef(false);
  allTeamsRef.current = allTeams;
  const accountRef = useRef<AuthAccount | null>(null);
  accountRef.current = account;

  const reloadInFlight = useRef<Promise<void> | null>(null);
  const reloadAccount = useCallback((): Promise<void> => {
    if (reloadInFlight.current) return reloadInFlight.current;
    const run = (async () => {
      try {
        const [me, nextInvites] = await Promise.all([apiGetMe(), fetchInvitesSafe()]);
        const before = activeRef.current;
        setInvites(nextInvites);
        applyAccount(me.user, before ?? readStoredTeamId(), allTeamsRef.current);
        // Fallback su un altro team: l'URL del vecchio team potrebbe non esistere più.
        if (before != null && !me.user.teams.some(team => team.id === before)) {
          window.history.replaceState(null, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch (err) {
        // Sessione chiusa solo su 401: un errore di rete non deve fare logout.
        if (err instanceof ApiError && err.status === 401) applyAccount(null, null);
      } finally {
        reloadInFlight.current = null;
      }
    })();
    reloadInFlight.current = run;
    return run;
  }, [applyAccount]);

  useEffect(() => {
    let cancelled = false;

    // Idratazione: una sola GET /api/auth/me all'avvio. Fino a che non
    // risponde non viene renderizzato nulla (stato `loading`).
    Promise.all([apiGetMe(), fetchInvitesSafe()]).then(
      ([me, nextInvites]) => {
        if (cancelled) return;
        setInvites(nextInvites);
        applyAccount(me.user, readStoredTeamId());
      },
      // 401 UNAUTHENTICATED (o errore di trasporto): si parte anonimi.
      () => { if (!cancelled) applyAccount(null, null); },
    );

    // Qualsiasi endpoint protetto che risponde 401 significa che la
    // sessione è morta durante l'uso: si torna anonimi e RequireAuth
    // reindirizza a /login conservando il percorso tentato.
    const onUnauthorized = () => applyAccount(null, null);
    // Team attivo rifiutato (rimozione dal team): si rilegge l'elenco e si
    // ripiega sul primo team rimasto, o sull'onboarding se non ce ne sono.
    const onTeamAccess = () => { void reloadAccount(); };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(TEAM_ACCESS_EVENT, onTeamAccess);

    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(TEAM_ACCESS_EVENT, onTeamAccess);
    };
  }, [applyAccount, reloadAccount]);

  const login = useCallback(async (email: string, password: string): Promise<AuthLoginResponse> => {
    const result = await apiLogin(email, password);
    if (result.status === 'AUTHENTICATED') {
      setInvites(await fetchInvitesSafe());
      applyAccount(result.user, readStoredTeamId());
    }
    return result;
  }, [applyAccount]);

  const changePassword = useCallback(
    async (email: string, session: string, newPassword: string): Promise<AuthChangePasswordResponse> => {
      const result = await apiChangePassword(email, session, newPassword);
      if (result.status === 'AUTHENTICATED') {
        setInvites(await fetchInvitesSafe());
        applyAccount(result.user, readStoredTeamId());
      }
      return result;
    },
    [applyAccount],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // La sessione locale viene comunque azzerata, a prescindere
      // dall'esito dell'endpoint.
    }
    clearStoredTeamId();
    applyAccount(null, null);
  }, [applyAccount]);

  const selectTeam = useCallback((teamId: number) => {
    // Il manager puro non entra nei singoli team: resta in Tutti i Team.
    if (!account || !canEnterTeams(account) || !account.teams.some(team => team.id === teamId)) return;
    setActiveTeamHeader(teamId);
    storeTeamId(teamId);
    setActiveTeamId(teamId);
    setAllTeams(false);
  }, [account]);

  const selectAllTeams = useCallback(() => {
    if (!account || !canUseAllTeams(account)) return;
    setActiveTeamHeader(ALL_TEAMS_HEADER_VALUE);
    storeSelection(ALL_TEAMS_STORED_VALUE);
    setAllTeams(true);
  }, [account]);

  const createTeam = useCallback(async (name: string): Promise<TeamSummary> => {
    const team = await apiCreateTeam(name);
    storeTeamId(team.id);
    const me = await apiGetMe();
    applyAccount(me.user, team.id, false);
    return team;
  }, [applyAccount]);

  // Errore di refresh: si conserva la lista visibile invece di svuotarla.
  const refreshInvitesKeepingOnError = useCallback(async () => {
    try {
      setInvites(await apiGetMyInvites());
    } catch {
      // Lista precedente mantenuta.
    }
  }, []);

  const acceptInvite = useCallback(async (teamId: number, role: AppRole) => {
    try {
      await apiAcceptInvite(teamId, role);
      // Un reload già in volo può contenere l'account pre-accettazione: si attende, poi si rilegge.
      await reloadInFlight.current;
      const me = await apiGetMe();
      applyAccount(me.user, teamId, false);
    } finally {
      await refreshInvitesKeepingOnError();
    }
  }, [applyAccount, refreshInvitesKeepingOnError]);

  const declineInvite = useCallback(async (teamId: number) => {
    try {
      await apiDeclineInvite(teamId);
    } finally {
      await refreshInvitesKeepingOnError();
    }
  }, [refreshInvitesKeepingOnError]);

  const user = useMemo(
    () => (account ? toUser(account, account.teams.find(team => team.id === activeTeamId) ?? null, allTeams) : null),
    [account, activeTeamId, allTeams],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status, user, account, teams: account?.teams ?? [], invites, activeTeamId, allTeams,
      login, changePassword, logout, selectTeam, selectAllTeams, createTeam, reloadAccount, acceptInvite, declineInvite,
    }),
    [status, user, account, invites, activeTeamId, allTeams, login, changePassword, logout, selectTeam, selectAllTeams, createTeam, reloadAccount, acceptInvite, declineInvite],
  );

  if (status === 'loading') return <AuthLoading />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return context;
}
