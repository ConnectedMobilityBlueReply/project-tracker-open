import { useEffect, useState } from 'react';
import type { ScheduleAllocation, TimeOffEntry } from '../types';
import { useAuth } from '../auth/AuthContext';
import { roleAtLeast } from '../auth/routeAccess';
import { useScheduleData } from '../components/schedule/useScheduleData';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import type { AssignMode } from '../components/schedule/ScheduleRow';
import BacklogPanel from '../components/schedule/BacklogPanel';
import { useScheduleBacklog } from '../components/schedule/useScheduleBacklog';
import ScheduleToolbar from '../components/schedule/ScheduleToolbar';
import ScheduleFilterMenu from '../components/schedule/ScheduleFilterMenu';
import AllocationModal from '../components/schedule/AllocationModal';
import AssignModal from '../components/schedule/AssignModal';
import type { AssignTarget } from '../components/schedule/AssignModal';
import TimeOffModal from '../components/schedule/TimeOffModal';
import { PageHeader } from '../components/app/PageHeader';
import { ErrorBanner, LoadingState } from '../components/app/StateMessages';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { localTodayIso } from '../lib/planningModel';
import { mondayOfIso } from '../lib/scheduleModel';
import { assignmentHint, rowKeyForPerson } from '../lib/scheduleBacklog';
import ScheduleLegend from '../components/schedule/ScheduleLegend';

export default function Schedule({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();

  // Il PM scrive, il member legge: /api/allocation-weeks/** risponde 403 a
  // un'identità member, quindi i comandi non vengono nemmeno mostrati.
  const canWrite = user != null && roleAtLeast(user.appRole, 'pm');

  const {
    view, projectId, from, to, rangeFrom, weeks, zoom, filters, sort, search, density, changeDensity,
    updateParams, changeFilters, data, setData, error, loading, load, loadProject, projects, projectOptions,
    rows, projectRowsUnfiltered, rowErrors, setRowErrors, moveAllocation, extendAllocation,
  } = useScheduleData(canWrite);

  const backlog = useScheduleBacklog(canWrite, { data, setData, reloadSchedule: load, setRowErrors });

  const today = localTodayIso();

  const [editing, setEditing] = useState<ScheduleAllocation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [editingTimeOff, setEditingTimeOff] = useState<TimeOffEntry | null>(null);

  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  const toggleRow = (key: string) => setExpandedKeys(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allExpanded = rows.length > 0 && rows.every(row => expandedKeys.has(row.key));
  const toggleExpandAll = () => setExpandedKeys(allExpanded ? new Set() : new Set(rows.map(row => row.key)));

  // Selezionare un item porta alla vista per persona e apre la riga della sua
  // persona: resta comprimibile a mano, a differenza di un'apertura forzata.
  const selectItem = (id: number | null) => {
    backlog.select(id);
    if (id == null) return;
    const picked = backlog.items.find(entry => entry.task_allocation_id === id);
    if (picked) setExpandedKeys(current => new Set(current).add(rowKeyForPerson(picked.person_id)));
    if (view !== 'person') updateParams({ view: 'person' });
  };

  const hasSelection = backlog.selected != null;
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // Esc chiude prima modali e menu aperti: la selezione resta.
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      backlog.select(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSelection, backlog.select]);

  const selectedItem = backlog.selected;
  const selectedRow = selectedItem
    ? rows.find(row => row.key === rowKeyForPerson(selectedItem.person_id))
    : undefined;
  const hint = selectedItem && data && view === 'person'
    ? assignmentHint({
        item: selectedItem, zoom, personRow: selectedRow,
        expanded: expandedKeys.has(rowKeyForPerson(selectedItem.person_id)), weeks,
        allocations: data.allocations, timeOff: data.time_off, otherTeamLoad: data.other_team_load ?? [],
      })
    : null;
  const assign: AssignMode | undefined = selectedItem && data && view === 'person' && zoom === 'weeks'
    ? { item: selectedItem, allocations: data.allocations, pending: backlog.pending, onAssign: backlog.assign }
    : undefined;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 p-4'}>
      {!embedded && <PageHeader title="Pianificazione" />}

      <ScheduleToolbar
        from={view === 'project' ? rangeFrom : from}
        to={to}
        today={today}
        zoom={zoom}
        density={density}
        sort={sort}
        view={view}
        canWrite={canWrite}
        projects={projects}
        projectId={projectId}
        filterSlot={view === 'person' ? (
          <ScheduleFilterMenu
            filters={filters}
            persons={data?.persons ?? []}
            projects={projectOptions}
            onChange={changeFilters}
          />
        ) : (
          <Input
            value={search}
            onChange={event => updateParams({ search: event.target.value })}
            placeholder="Cerca task o persona…"
            aria-label="Cerca task o persona nella vista per progetto"
            className="h-8 w-56"
          />
        )}
        onViewChange={next => updateParams({ view: next })}
        onProjectChange={next => updateParams({ project: next == null ? '' : String(next) })}
        onRangeChange={(nextFrom, nextTo) => updateParams({ from: nextFrom, to: nextTo })}
        onZoomChange={nextZoom => updateParams({ zoom: nextZoom })}
        onDensityChange={changeDensity}
        onSortChange={next => updateParams({ sort: next.key, sortDir: next.descending ? 'desc' : 'asc' })}
        onAddTimeOff={() => { setEditingTimeOff(null); setTimeOffOpen(true); }}
        allExpanded={allExpanded}
        onToggleExpandAll={view === 'person' ? toggleExpandAll : undefined}
        backlogCount={canWrite && backlog.loaded && !backlog.loadError ? backlog.items.length : null}
        backlogOpen={backlog.open}
        onToggleBacklog={canWrite ? () => backlog.setOpen(!backlog.open) : undefined}
      />

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {loading && <LoadingState />}

          {error && (
            <ErrorBanner onRetry={() => { load(); loadProject(); }}>
              {/* `error` è scritto sia da `load` che da `loadProject`: senza sapere
                  quale delle due sia fallita, "Riprova" deve ripetere entrambe. */}
              Caricamento non riuscito: {error}
            </ErrorBanner>
          )}

          {data && !error && (
            <ScheduleGrid
              rows={rows}
              teamAllocations={data.allocations}
              weeks={weeks}
              timeOff={data.time_off}
              otherTeamLoad={data.other_team_load ?? []}
              zoom={zoom}
              density={density}
              headerLabel={view === 'project' ? 'Attività' : 'Persona'}
              emptyMessage={view === 'project'
                ? (projectId == null
                    ? 'Seleziona un progetto per vederne le assegnazioni.'
                    : projectRowsUnfiltered.length === 0
                      ? 'Questo progetto non ha ancora assegnazioni.'
                      : 'Nessuna allocazione corrisponde alla ricerca.')
                : 'Nessuna persona corrisponde ai filtri attivi.'}
              canWrite={canWrite}
              onOpenAllocation={canWrite ? allocation => {
                setEditing(allocation);
                setModalOpen(true);
              } : undefined}
              onOpenCell={canWrite ? (row, weekStart) => {
                setAssignTarget({
                  personId: row.person.id,
                  personName: row.person.name,
                  weekStart,
                  // Solo la vista per progetto sa già a quale progetto appartiene
                  // la riga: in vista per persona la scelta parte vuota.
                  projectId: view === 'project' ? projectId : null,
                  taskAllocationId: row.taskAllocationId,
                });
                setAssignOpen(true);
              } : undefined}
              onDropAllocation={canWrite ? moveAllocation : undefined}
              // Estendere aggiunge giorni allocati: il residuo del backlog va riletto a fine salvataggio.
          onResizeAllocation={canWrite ? async (allocationId, personId, weekStart, rowKey) => {
            await extendAllocation(allocationId, personId, weekStart, rowKey);
            backlog.reload();
          } : undefined}
              onOpenTimeOff={entry => { setEditingTimeOff(entry); setTimeOffOpen(true); }}
              rowErrors={rowErrors}
              expandedKeys={expandedKeys}
              compressible={view === 'person'}
              onToggleRow={toggleRow}
              showTeamRow={view === 'person'}
              currentWeek={mondayOfIso(today)}
              assign={assign}
            />
          )}
          {data && !error && <ScheduleLegend />}

        </div>

        {canWrite && backlog.open && (
          <BacklogPanel
            items={backlog.items}
            loading={backlog.loading || !backlog.loaded}
            error={backlog.loadError}
            selectedId={backlog.selected?.task_allocation_id ?? null}
            hint={hint}
            onSelect={selectItem}
            onRetry={backlog.reload}
            onClose={() => backlog.setOpen(false)}
          />
        )}
      </div>

      <AllocationModal
        open={modalOpen}
        allocation={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => { load(); backlog.reload(); }}
      />

      <AssignModal
        open={assignOpen}
        target={assignTarget}
        onClose={() => setAssignOpen(false)}
        onSaved={() => { load(); loadProject(); backlog.reload(); }}
      />

      <TimeOffModal
        open={timeOffOpen}
        entry={editingTimeOff}
        defaultPersonId={user?.personId ?? null}
        persons={data?.persons ?? []}
        onClose={() => setTimeOffOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
