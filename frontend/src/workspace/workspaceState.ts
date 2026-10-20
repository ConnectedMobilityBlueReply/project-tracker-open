export interface WorkspacePreferences {
  sidebarCollapsed: boolean;
}

export interface WorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const WORKSPACE_STORAGE_KEYS = {
  sidebarCollapsed: 'project-tracker:sidebar-collapsed',
} as const;

// Chiavi scritte dalle versioni pre-auth: rimosse sia in lettura (pulizia
// sincrona durante l'inizializzazione dello storage, PRIMA del primo render)
// sia in scrittura — identità, persona attiva e workspace non devono
// sopravvivere sul dispositivo: arrivano dal server.
const LEGACY_STORAGE_KEYS = ['project-tracker:workspace', 'project-tracker:person-id'] as const;

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  sidebarCollapsed: false,
};

export function readWorkspacePreferences(storage: WorkspaceStorage): WorkspacePreferences {
  // Pulizia sincrona, prima di qualsiasi render: un utente che torna non
  // deve mai avere chiavi di identità stale in storage durante il round
  // trip di /api/auth/me.
  for (const key of LEGACY_STORAGE_KEYS) {
    storage.removeItem(key);
  }
  const storedCollapsed = storage.getItem(WORKSPACE_STORAGE_KEYS.sidebarCollapsed);
  return {
    sidebarCollapsed: storedCollapsed === '1',
  };
}

export function writeWorkspacePreferences(
  storage: WorkspaceStorage,
  preferences: WorkspacePreferences,
): void {
  storage.setItem(
    WORKSPACE_STORAGE_KEYS.sidebarCollapsed,
    preferences.sidebarCollapsed ? '1' : '0',
  );
  for (const key of LEGACY_STORAGE_KEYS) {
    storage.removeItem(key);
  }
}
