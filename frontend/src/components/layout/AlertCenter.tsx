import { Bell, Warning } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAlerts } from '../../api';
import { alertTotal, desktopBridge, forwardAlertCount } from '../../lib/desktopBridge';
import type { AlertsData } from '../../types';

export interface AlertState {
  alerts: AlertsData | null;
  error: boolean;
  reload(): void;
}

/** `enabled` falso (Tutti i Team): niente fetch né intervallo, /api/alerts non è aggregato. */
export function useAlerts(enabled: boolean): AlertState {
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [error, setError] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const reload = useCallback(() => {
    if (!enabled) return;
    if (inFlightRef.current) return inFlightRef.current;

    const requestId = ++requestIdRef.current;
    const request = getAlerts().then(
      nextAlerts => {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setAlerts(nextAlerts);
          setError(false);
          forwardAlertCount(nextAlerts);
        }
      },
      () => {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setError(true);
        }
      },
    ).finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
    });

    inFlightRef.current = request;
    return request;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Niente alert di un team precedente: anche il badge OS torna a zero.
      setAlerts(null);
      setError(false);
      desktopBridge()?.setAlertCount(0);
      return;
    }
    mountedRef.current = true;
    void reload();
    const id = window.setInterval(reload, 5 * 60 * 1000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [enabled, reload]);

  return { alerts, error, reload };
}

export default function AlertCenter({ state }: { state: AlertState }) {
  const [isOpen, setIsOpen] = useState(false);
  const total = state.alerts ? alertTotal(state.alerts) : 0;

  if (!state.error && total === 0) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          iconOnly
          tooltip={false}
          variant="ghost"
          aria-label={state.error ? 'Alert non disponibili' : 'Alert attivi'}
          className="relative min-h-11 min-w-11 text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Bell aria-hidden="true" className="size-5" />
          {total > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 min-w-5 px-1">
              {total > 9 ? '9+' : total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80">
        {state.error ? (
          <div className="space-y-3">
            <PopoverTitle className="text-sm">Impossibile aggiornare gli alert</PopoverTitle>
            <Button size="sm" variant="outline" onClick={state.reload}>Riprova</Button>
          </div>
        ) : (
          <>
            <PopoverTitle className="text-sm">Alert attivi</PopoverTitle>
            <div className="mt-2 space-y-2 text-xs">
              {state.alerts?.overcapacity_persons ? (
                <div className="flex items-center gap-2 font-medium text-destructive">
                  <Warning aria-hidden="true" className="size-3.5 shrink-0" />
                  {state.alerts.overcapacity_persons} {state.alerts.overcapacity_persons === 1 ? 'persona over-capacity' : 'persone over-capacity'} questa settimana
                </div>
              ) : null}
              {state.alerts?.overdue_wbs ? (
                <div className="font-medium text-destructive">
                  {state.alerts.overdue_wbs} WBS {state.alerts.overdue_wbs === 1 ? 'item scaduto' : 'items scaduti'}
                </div>
              ) : null}
              {state.alerts?.tm_plafond_projects ? (
                <div className="font-medium text-destructive">
                  {state.alerts.tm_plafond_projects} {state.alerts.tm_plafond_projects === 1 ? 'progetto T&M' : 'progetti T&M'} all'80% del plafond o oltre
                </div>
              ) : null}
              {state.alerts?.overdue_list.length ? (
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  {state.alerts.overdue_list.slice(0, 5).map(item => (
                    <li key={item.id} className="truncate">
                      <span className="font-medium text-destructive">{item.planned_end}</span> — {item.name} ({item.project_name})
                    </li>
                  ))}
                  {state.alerts.overdue_list.length > 5 && (
                    <li>+{state.alerts.overdue_list.length - 5} altri...</li>
                  )}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
