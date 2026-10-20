export const TEAM_HEADER = 'X-Team-Id';

/** Valore di X-Team-Id in Tutti i Team (manager e super-admin). */
export const ALL_TEAMS_HEADER_VALUE = 'all';

/** Emesso quando il backend rifiuta il team attivo (rimosso dal team, team cancellato). */
export const TEAM_ACCESS_EVENT = 'project-tracker:team-access';

export function buildHeaders(teamId: number | 'all' | null, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (teamId == null) headers.delete(TEAM_HEADER);
  else headers.set(TEAM_HEADER, String(teamId));
  return headers;
}

/** In Tutti i Team un TEAM_REQUIRED significa «endpoint fuori allowlist»: ricaricare l'account non lo
 *  risolve e farebbe ripartire le fetch della pagina in loop, quindi non conta come team rifiutato. */
export function isTeamAccessError(status: number, code: string | null, activeTeam?: number | 'all' | null): boolean {
  if (status !== 403) return false;
  if (code === 'TEAM_FORBIDDEN') return true;
  return code === 'TEAM_REQUIRED' && activeTeam !== ALL_TEAMS_HEADER_VALUE;
}
