/** Stati che chiudono la pianificazione. Specchio di ProjectScope.plannableSql nel backend. */
export const PLANNING_CLOSED_STATUSES: readonly string[] = ['concluso', 'lavorato a consuntivo'];

/** Il progetto accetta ancora pianificazione. Stato assente: aperto (come COALESCE lato SQL). */
export const isPlannableProject = (project: { status?: string | null }): boolean =>
  !PLANNING_CLOSED_STATUSES.includes(project.status ?? '');
