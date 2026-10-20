import type { AuthAccount, TeamSummary, User } from '../types.ts';

export const ACTIVE_TEAM_STORAGE_KEY = 'project-tracker:active-team';
/** Valore salvato al posto dell'id quando è scelta la modalità Tutti i Team. */
export const ALL_TEAMS_STORED_VALUE = 'all';

export function parseStoredTeamId(raw: string | null): number | null {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
}

/** Team attivo: quello salvato se l'utente ne fa ancora parte, altrimenti il primo. */
export function resolveActiveTeam(teams: readonly TeamSummary[], storedId: number | null): TeamSummary | null {
  return teams.find(team => team.id === storedId) ?? teams[0] ?? null;
}

/** La modalità Tutti i Team è di manager e super-admin; il backend resta l'autorità su /api/bu/**. */
export function canUseAllTeams(account: Pick<AuthAccount, 'manager' | 'platformAdmin'>): boolean {
  return account.manager === true || account.platformAdmin === true;
}

/** Manager senza super-admin: vede solo Tutti i Team e non entra nei singoli team. */
export function isPureManager(account: Pick<AuthAccount, 'manager' | 'platformAdmin'>): boolean {
  return account.manager === true && account.platformAdmin !== true;
}

/** Chi può entrare in un singolo team: tutti tranne il manager puro. */
export function canEnterTeams(account: Pick<AuthAccount, 'manager' | 'platformAdmin'>): boolean {
  return !isPureManager(account);
}

/** Il manager puro è sempre in Tutti i Team. Per gli altri: 'all' salvato vince, un team salvato la esclude; senza scelta parte il manager (il super-admin resta nel suo team). */
export function resolveAllTeamsMode(
  account: Pick<AuthAccount, 'manager' | 'platformAdmin'>,
  storedRaw: string | null,
): boolean {
  if (!canUseAllTeams(account)) return false;
  if (isPureManager(account)) return true;
  if (storedRaw === ALL_TEAMS_STORED_VALUE) return true;
  if (parseStoredTeamId(storedRaw) != null) return false;
  return account.manager === true;
}

/** Modalità Tutti i Team al cambio account: il manager puro vi resta sempre, anche se la preferenza è false (createTeam, acceptInvite). Gli altri: preferenza esplicita, altrimenti quella salvata. */
export function resolveAggregateMode(
  account: Pick<AuthAccount, 'manager' | 'platformAdmin'>,
  preference: boolean | null,
  storedRaw: string | null,
): boolean {
  if (!canUseAllTeams(account)) return false;
  if (isPureManager(account)) return true;
  return preference ?? resolveAllTeamsMode(account, storedRaw);
}

/** Utente visto dalle pagine: ruolo e team sono quelli del team attivo; readOnly viene solo dal team (team di appoggio del manager). */
export function toUser(account: AuthAccount, team: TeamSummary | null, allTeams = false): User | null {
  if (team == null) return null;
  const aggregate = allTeams && canUseAllTeams(account);
  return {
    personId: account.personId,
    name: account.name,
    email: account.email,
    platformAdmin: account.platformAdmin,
    manager: account.manager === true,
    readOnly: team.read_only === true,
    allTeams: aggregate,
    appRole: team.role,
    teamId: team.id,
    teamName: team.name,
  };
}
