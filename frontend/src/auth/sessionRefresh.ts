/**
 * Macchina di rinnovo sessione, estratta come logica pura per essere
 * testabile senza DOM né React.
 *
 * - `createSessionRefresher` garantisce single-flight: più 401 concorrenti
 *   condividono UNA sola chiamata di refresh; al fallimento
 *   `onSessionExpired` scatta esattamente una volta per ciclo.
 * - `fetchWithSessionRefresh` applica la politica: 401 su endpoint NON /auth
 *   → refresh una volta → retry della richiesta originale una volta.
 *   Un 401 su /api/auth/* (incluso /api/auth/refresh) non può mai innescare
 *   un altro refresh: nessun loop.
 */

export interface SessionRefresherDeps {
  /** Chiamata di refresh (es. POST /api/auth/refresh); rifiuta se la
   *  sessione è scaduta o in caso di errore di rete. */
  refresh(): Promise<unknown>;
  /** Segnalazione di sessione scaduta: scatta UNA volta per ciclo fallito,
   *  non una volta per ogni richiesta in attesa. */
  onSessionExpired(): void;
}

export function createSessionRefresher(deps: SessionRefresherDeps): () => Promise<boolean> {
  let inFlight: Promise<boolean> | null = null;

  return function refresh(): Promise<boolean> {
    if (inFlight != null) return inFlight;

    inFlight = deps
      .refresh()
      .then(() => true)
      .catch(() => {
        deps.onSessionExpired();
        return false;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
}

export interface SessionRequestDeps {
  fetchImpl(url: string, options?: RequestInit): Promise<Response>;
  isAuthUrl(url: string): boolean;
  refresh(): Promise<boolean>;
  onUnauthorized(): void;
}

/** 401 su endpoint protetto → refresh single-flight → retry una sola volta.
 *  Se il refresh fallisce viene restituita la risposta 401 originale (la
 *  segnalazione di sessione scaduta è già stata emessa dal refresher). */
export async function fetchWithSessionRefresh(
  url: string,
  options: RequestInit | undefined,
  deps: SessionRequestDeps,
): Promise<Response> {
  const first = await deps.fetchImpl(url, options);
  if (first.status !== 401 || deps.isAuthUrl(url)) return first;

  const refreshed = await deps.refresh();
  if (!refreshed) return first;

  const retry = await deps.fetchImpl(url, options);
  if (retry.status === 401) deps.onUnauthorized();
  return retry;
}
