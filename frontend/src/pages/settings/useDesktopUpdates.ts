import { useEffect, useMemo, useState } from 'react';
import { desktopBridge, type UpdateState } from '@/lib/desktopBridge';

export const SETTINGS_UPDATES_PATH = '/impostazioni/aggiornamenti';

/** Stato dell'updater desktop; null nel browser o con app desktop senza `updates`. */
export function useDesktopUpdates() {
  const updates = desktopBridge()?.updates;
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    if (!updates) return undefined;
    let pushed = false;
    let active = true;
    const off = updates.onState((next) => {
      pushed = true;
      setState(next);
    });
    // Se un evento arriva prima della risposta, la risposta è più vecchia: si scarta.
    void updates.getState().then((initial) => {
      if (active && !pushed && initial) setState(initial);
    });
    return () => {
      active = false;
      off();
    };
  }, [updates]);

  return useMemo(() => (updates
    ? { state, check: () => void updates.check(), install: () => void updates.install() }
    : null), [updates, state]);
}
