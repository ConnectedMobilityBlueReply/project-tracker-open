// Stato unico dell'updater, condiviso da controllo automatico e manuale. Puro: niente electron qui.

export function initialUpdateState(currentVersion, supported) {
  return { status: supported ? 'idle' : 'unsupported', version: null, percent: null, checkedAt: null, currentVersion };
}

const clampPercent = (value) => (Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0);

export function reduceUpdateState(state, event, now) {
  if (state.status === 'unsupported') return state;
  // ready resta fino al riavvio: un controllo o un errore successivo non deve togliere "Riavvia e installa".
  // Solo una versione diversa scaricata in background la sostituisce, così il riavvio installa la più recente.
  if (state.status === 'ready') {
    return event.type === 'downloaded' && event.version !== state.version
      ? { ...state, version: event.version, percent: null }
      : state;
  }
  switch (event.type) {
    case 'checking':
      return { ...state, status: 'checking', version: null, percent: null };
    case 'not-available':
      return { ...state, status: 'up-to-date', version: null, percent: null, checkedAt: now };
    case 'available':
      return { ...state, status: 'downloading', version: event.version, percent: 0, checkedAt: now };
    case 'progress':
      return state.status === 'downloading' ? { ...state, percent: clampPercent(event.percent) } : state;
    case 'downloaded':
      return { ...state, status: 'ready', version: event.version, percent: null };
    case 'error':
      return { ...state, status: 'error', version: null, percent: null, checkedAt: now };
    default:
      return state;
  }
}

export const canCheck = (state) => ['idle', 'up-to-date', 'error'].includes(state.status);
export const canAutoCheck = (state) => !['checking', 'downloading', 'unsupported'].includes(state.status);
export const canInstall = (state) => state.status === 'ready';
