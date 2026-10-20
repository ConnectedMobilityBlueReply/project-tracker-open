import type { UpdateState } from './desktopBridge.ts';

export interface UpdateStatusView {
  message: string;
  tone: 'neutral' | 'success' | 'danger';
  action: 'check' | 'install' | null;
  actionLabel: string;
  /** Azione visibile ma disabilitata, con spinner. */
  busy: boolean;
  showProgress: boolean;
}

const CHECK = { action: 'check', actionLabel: 'Controlla aggiornamenti' } as const;
const NO_ACTION = { action: null, actionLabel: '' } as const;
const IDLE = { busy: false, showProgress: false } as const;

export function updateStatusView(state: UpdateState): UpdateStatusView {
  switch (state.status) {
    case 'idle':
      return { message: 'Gli aggiornamenti vengono controllati automaticamente ogni 4 ore.', tone: 'neutral', ...CHECK, ...IDLE };
    case 'checking':
      return { message: 'Controllo in corso…', tone: 'neutral', ...CHECK, busy: true, showProgress: false };
    case 'up-to-date':
      return { message: "Hai l'ultima versione.", tone: 'success', ...CHECK, ...IDLE };
    case 'downloading':
      return { message: `Download versione ${state.version}…`, tone: 'neutral', ...NO_ACTION, busy: false, showProgress: true };
    case 'ready':
      return {
        message: `Versione ${state.version} pronta. Verrà installata alla chiusura dell'app.`,
        tone: 'success', action: 'install', actionLabel: 'Riavvia e installa', ...IDLE,
      };
    case 'error':
      return { message: 'Controllo non riuscito. Verifica la connessione e riprova.', tone: 'danger', action: 'check', actionLabel: 'Riprova', ...IDLE };
    case 'unsupported':
      return { message: 'Aggiornamenti non disponibili in questa build.', tone: 'neutral', ...NO_ACTION, ...IDLE };
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "mai" | "oggi alle HH:MM" | "il DD/MM alle HH:MM", in ora locale. */
export function formatCheckedAt(checkedAt: string | null, now: Date): string {
  if (!checkedAt) return 'mai';
  const at = new Date(checkedAt);
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  return at.toDateString() === now.toDateString()
    ? `oggi alle ${time}`
    : `il ${pad(at.getDate())}/${pad(at.getMonth() + 1)} alle ${time}`;
}
