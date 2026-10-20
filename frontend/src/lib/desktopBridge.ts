import type { AlertsData } from '../types';

export interface TitleBarColors {
  color: string;
  symbolColor: string;
}

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'error' | 'unsupported';

/** Stato dell'updater del main process (IPC, quindi camelCase: non passa dal backend). */
export interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  percent: number | null;
  checkedAt: string | null;
  currentVersion: string;
}

export interface DesktopUpdates {
  /** `null` quando il main rifiuta la chiamata (origine esterna). */
  getState(): Promise<UpdateState | null>;
  check(): Promise<UpdateState | null>;
  install(): Promise<void>;
  onState(callback: (state: UpdateState) => void): () => void;
}

export interface DesktopBridge {
  platform: string;
  setAlertCount(count: number): void;
  setTitleBarColors(colors: TitleBarColors): void;
  /** Assente nel browser e nelle versioni desktop che non hanno ancora questa funzione. */
  updates?: DesktopUpdates;
}

// Nell'app desktop il preload espone window.desktop; nel browser non esiste.
export function desktopBridge(): DesktopBridge | undefined {
  return (globalThis as unknown as { desktop?: DesktopBridge }).desktop;
}

export function hasDesktopUpdates(bridge: Pick<DesktopBridge, 'updates'> | undefined = desktopBridge()): boolean {
  return bridge?.updates != null;
}

export function alertTotal(alerts: AlertsData): number {
  // `?? 0`: un backend non ancora aggiornato non deve produrre NaN durante il rollout.
  return alerts.overdue_wbs + alerts.overcapacity_persons + (alerts.tm_plafond_projects ?? 0);
}

// Nel browser bridge è undefined e la chiamata non fa nulla.
export function forwardAlertCount(
  alerts: AlertsData,
  bridge: Pick<DesktopBridge, 'setAlertCount'> | undefined = desktopBridge(),
): void {
  bridge?.setAlertCount(alertTotal(alerts));
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function forwardTitleBarColors(
  colors: TitleBarColors,
  bridge: Pick<DesktopBridge, 'setTitleBarColors'> | undefined = desktopBridge(),
): void {
  bridge?.setTitleBarColors(colors);
}
