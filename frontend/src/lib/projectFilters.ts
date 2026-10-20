import type { Project } from '../types';

export interface ProjectFilters {
  q: string;
  stato: string;
  societa: string;
  area: string;
  pm: string;
}

export const EMPTY_FILTERS: ProjectFilters = { q: '', stato: '', societa: '', area: '', pm: '' };

type FilterableProject = Pick<Project, 'name' | 'status' | 'area' | 'pm_riferimento_cliente' | 'societa'>;

const KEYS = ['q', 'stato', 'societa', 'area', 'pm'] as const;
// pm e un cognome reale (dato personale): resta stato locale della pagina, mai in query string
const URL_KEYS = ['q', 'stato', 'societa', 'area'] as const;

/** Filtri dalla query string: parametro assente = nessun filtro. Valori non validati: un valore sconosciuto non trova nulla. `pm` non e mai letto dall'URL. */
export function parseFilters(params: URLSearchParams): ProjectFilters {
  return {
    q: params.get('q') ?? '',
    stato: params.get('stato') ?? '',
    societa: params.get('societa') ?? '',
    area: params.get('area') ?? '',
    pm: '',
  };
}

/** Query string con i soli filtri attivi, `pm` escluso. */
export function serializeFilters(filters: ProjectFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of URL_KEYS) {
    if (filters[key] !== '') params.set(key, filters[key]);
  }
  return params;
}

const isSet = (value: string): boolean => value.trim() !== '';

export function hasActiveFilters(filters: ProjectFilters): boolean {
  return KEYS.some(key => isSet(filters[key]));
}

/** Nome: contiene, senza maiuscole. Gli altri filtri: uguaglianza esatta. Tutti in AND. */
export function applyFilters<T extends FilterableProject>(projects: readonly T[], filters: ProjectFilters): T[] {
  const needle = filters.q.trim().toLowerCase();
  return projects.filter(project => {
    if (needle && !project.name.toLowerCase().includes(needle)) return false;
    if (isSet(filters.stato) && project.status !== filters.stato) return false;
    if (isSet(filters.societa) && project.societa !== filters.societa) return false;
    if (isSet(filters.area) && project.area !== filters.area) return false;
    if (isSet(filters.pm) && project.pm_riferimento_cliente !== filters.pm) return false;
    return true;
  });
}
