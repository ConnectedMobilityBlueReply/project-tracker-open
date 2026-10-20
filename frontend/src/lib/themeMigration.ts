/** Chiave di next-themes in localStorage (default della libreria). */
export const THEME_STORAGE_KEY = 'theme';

const VALID = new Set(['light', 'dark', 'system']);
// Map, non oggetto literale: con un oggetto `REMOVED['constructor']` risolve a una funzione del prototipo.
const REMOVED = new Map([['cream', 'light'], ['moonlight', 'dark']]);

/** Porta una preferenza salvata su un tema ancora esistente. `null` = nessuna preferenza. */
export function migrateThemeValue(value: string | null): string | null {
  if (value == null) return null;
  if (VALID.has(value)) return value;
  return REMOVED.get(value) ?? 'system';
}

/** Da chiamare in main.tsx prima del mount di React: la SPA non ha uno script bloccante in head, next-themes legge la chiave al mount. */
export function migrateStoredTheme(storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  try {
    const current = storage.getItem(THEME_STORAGE_KEY);
    const next = migrateThemeValue(current);
    if (next != null && next !== current) storage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage non disponibile (es. navigazione privata): next-themes ricade sul default.
  }
}
