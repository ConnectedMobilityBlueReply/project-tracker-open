import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  readWorkspacePreferences,
  WorkspacePreferences,
  writeWorkspacePreferences,
} from './workspaceState';

// Il workspace e la persona attiva arrivano dal server (ruolo dell'utente
// autenticato): qui resta solo la preferenza UI della sidebar.
interface WorkspaceContextValue extends WorkspacePreferences {
  setSidebarCollapsed(collapsed: boolean): void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<WorkspacePreferences>(() =>
    readWorkspacePreferences(window.localStorage),
  );

  useEffect(() => {
    writeWorkspacePreferences(window.localStorage, preferences);
  }, [preferences]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    ...preferences,
    setSidebarCollapsed: (sidebarCollapsed) =>
      setPreferences(current => ({ ...current, sidebarCollapsed })),
  }), [preferences]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace deve essere usato dentro WorkspaceProvider');
  return context;
}
