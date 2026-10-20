import { useCallback, useEffect, useRef, useState } from 'react';
import { ListChecks } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { PageHeader } from '@/components/app/PageHeader';
import { SectionCard } from '@/components/app/SectionCard';
import { UndoToast, useUndoToast } from '@/components/app/UndoToast';
import { TaskGroupList } from '@/components/miei-task/TaskGroupList';
import { TaskRow } from '@/components/miei-task/TaskRow';
import { groupTasks, type TaskSortBy } from '@/lib/mieiTaskGroups';
import { getWbsItemsByPerson, patchWbsProgress } from '../api';
import { WbsPersonTask, WbsStatus } from '../types';
import { useAuth } from '../auth/AuthContext';
import { clampPercentage } from '../lib/validation';

function currentDayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function MieiTask() {
  const { user } = useAuth();
  const activePersonId = user?.personId ?? null;
  const [items, setItems] = useState<WbsPersonTask[]>([]);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [localPct, setLocalPct] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveRetry, setSaveRetry] = useState<(() => void) | null>(null);
  const [errorViewKey, setErrorViewKey] = useState<string | null>(null);
  const [loadedViewKey, setLoadedViewKey] = useState<string | null>(null);
  const [today, setToday] = useState(currentDayKey);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<number | 'all'>('all');
  const [sortBy, setSortBy] = useState<TaskSortBy>('due');
  const undoToast = useUndoToast();
  const viewVersionRef = useRef(0);
  const viewKeyRef = useRef<string | null>(null);
  const loadedViewKeyRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const viewKey = activePersonId != null ? String(activePersonId) : null;

  if (viewKeyRef.current !== viewKey) {
    viewKeyRef.current = viewKey;
    viewVersionRef.current += 1;
  }

  const isCurrentView = (key: string, version: number) =>
    viewKeyRef.current === key && viewVersionRef.current === version;

  const isLoadedView = (key: string, version: number) =>
    isCurrentView(key, version) && loadedViewKeyRef.current === key;

  useEffect(() => {
    const interval = window.setInterval(() => setToday(currentDayKey()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const loadItems = useCallback(async (personId: number, key: string, version: number) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    setErrorViewKey(null);
    try {
      const data = await getWbsItemsByPerson(personId);
      if (!isCurrentView(key, version) || requestRef.current !== requestId) return;

      const pct: Record<number, number> = {};
      data.forEach(item => { pct[item.id] = clampPercentage(item.completion_pct); });
      loadedViewKeyRef.current = key;
      setItems(data);
      setLocalPct(pct);
      setLoadedViewKey(key);
      setSaveError(null);
      setSaveRetry(null);
    } catch {
      if (isCurrentView(key, version) && requestRef.current === requestId) {
        setError('Errore nel caricamento dei task WBS');
        setErrorViewKey(key);
      }
    } finally {
      if (isCurrentView(key, version) && requestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const version = viewVersionRef.current;
    loadedViewKeyRef.current = null;
    setLoadedViewKey(null);
    setItems([]);
    setSaving({});
    setLocalPct({});
    setError(null);
    setSaveError(null);
    setSaveRetry(null);
    setErrorViewKey(null);
    undoToast.dismiss();

    if (activePersonId == null || viewKey == null) {
      setLoading(false);
      return;
    }

    void loadItems(activePersonId, viewKey, version);
    return () => {
      if (isCurrentView(viewKey, version)) requestRef.current += 1;
    };
  }, [activePersonId, viewKey, loadItems, undoToast.dismiss]);

  async function handleStatusChange(
    item: WbsPersonTask,
    status: WbsStatus,
    { includePct = true }: { includePct?: boolean } = {},
  ): Promise<boolean> {
    const key = viewKey;
    const version = viewVersionRef.current;
    if (key == null || !isLoadedView(key, version)) return false;

    setSaveError(null);
    setSaveRetry(null);
    setSaving(s => ({ ...s, [item.id]: true }));
    try {
      await patchWbsProgress(item.id, includePct
        ? { status, completion_pct: clampPercentage(localPct[item.id] ?? item.completion_pct) }
        : { status });
      if (isLoadedView(key, version)) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status } : i));
      }
      return isLoadedView(key, version);
    } catch {
      if (isLoadedView(key, version)) {
        setSaveError('Errore nel salvataggio del task WBS');
        setSaveRetry(() => () => {
          void handleStatusChange(item, status, { includePct });
        });
      }
      return false;
    } finally {
      if (isLoadedView(key, version)) {
        setSaving(s => ({ ...s, [item.id]: false }));
      }
    }
  }

  async function handlePctBlur(item: WbsPersonTask) {
    const key = viewKey;
    const version = viewVersionRef.current;
    if (key == null || !isLoadedView(key, version)) return;

    const pct = clampPercentage(localPct[item.id] ?? item.completion_pct);
    if (pct === item.completion_pct) return;
    setSaveError(null);
    setSaveRetry(null);
    setSaving(s => ({ ...s, [item.id]: true }));
    try {
      await patchWbsProgress(item.id, { completion_pct: pct });
      if (isLoadedView(key, version)) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, completion_pct: pct } : i));
      }
    } catch {
      if (isLoadedView(key, version)) {
        setSaveError('Errore nel salvataggio del task WBS');
        setSaveRetry(() => () => {
          void handlePctBlur(item);
        });
      }
    } finally {
      if (isLoadedView(key, version)) {
        setSaving(s => ({ ...s, [item.id]: false }));
      }
    }
  }

  function handlePctChange(itemId: number, pct: number) {
    const key = viewKey;
    const version = viewVersionRef.current;
    if (key == null || !isLoadedView(key, version)) return;
    setLocalPct(current => ({ ...current, [itemId]: clampPercentage(Math.trunc(pct)) }));
  }

  const hasLoadedCurrentView = viewKey != null && loadedViewKey === viewKey;
  const hasCurrentViewError = error != null && errorViewKey === viewKey;
  const needle = query.trim().toLowerCase();
  const visible = items.filter(item =>
    (projectFilter === 'all' || item.project_id === projectFilter) &&
    (needle === '' || `${item.name} ${item.project_name}`.toLowerCase().includes(needle)));
  const groups = groupTasks(visible, today, sortBy);
  const projectOptions = [...new Map(items.map((i): [number, string] => [i.project_id, i.project_name])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'it'));

  async function changeStatus(item: WbsPersonTask, status: WbsStatus) {
    const previous = item.status;
    const saved = await handleStatusChange(item, status);
    if (saved && status === 'chiuso') {
      undoToast.show({
        message: `"${item.name}" chiuso`,
        // Solo lo stato: il % va in un PATCH separato e non va ripristinato dallo snapshot.
        undo: async () => { await handleStatusChange(item, previous, { includePct: false }); },
      });
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="I miei task" description="Task WBS assegnati alla persona attiva" />

      {viewKey != null && saveError && (
        <ErrorBanner onRetry={() => saveRetry?.()}>{saveError}</ErrorBanner>
      )}

      {viewKey != null && (
        <SectionCard title="Attività assegnate" icon={<ListChecks />} bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <Input
              type="search" placeholder="Cerca task o progetto…" aria-label="Cerca task"
              value={query} onChange={event => setQuery(event.target.value)} className="w-64"
            />
            <Select value={String(projectFilter)} onValueChange={value => setProjectFilter(value === 'all' ? 'all' : Number(value))}>
              <SelectTrigger className="w-56" aria-label="Filtra per progetto"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i progetti</SelectItem>
                {projectOptions.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={value => setSortBy(value as TaskSortBy)}>
              <SelectTrigger className="w-44" aria-label="Ordina per"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Ordina: scadenza</SelectItem>
                <SelectItem value="project">Ordina: progetto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasCurrentViewError ? (
            <div className="p-4">
              <ErrorBanner onRetry={() => {
                if (activePersonId != null && viewKey != null) {
                  void loadItems(activePersonId, viewKey, viewVersionRef.current);
                }
              }}>{error}</ErrorBanner>
            </div>
          ) : loading || !hasLoadedCurrentView ? (
            <LoadingState />
          ) : visible.length === 0 ? (
            <EmptyState
              title="Nessun task"
              description={items.length === 0 ? 'Nessun task WBS assegnato a questa persona.' : 'Nessun task corrisponde ai filtri.'}
            />
          ) : (
            <TaskGroupList
              groups={groups}
              renderItem={item => (
                <TaskRow
                  key={item.id}
                  item={item}
                  today={today}
                  pct={clampPercentage(localPct[item.id] ?? item.completion_pct)}
                  saving={saving[item.id] === true}
                  onStatusChange={status => void changeStatus(item, status)}
                  onPctChange={value => handlePctChange(item.id, value)}
                  onPctCommit={() => void handlePctBlur(item)}
                />
              )}
            />
          )}
        </SectionCard>
      )}

      <UndoToast notice={undoToast.notice} onDismiss={undoToast.dismiss} />
    </div>
  );
}
