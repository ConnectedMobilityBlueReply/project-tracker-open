import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import {
  getProjects, createProject, updateProject, deleteProject, getProject,
  getPersons, createTask, updateTask, deleteTask, setProjectPhases,
  upsertAllocation, deleteAllocation,
  addTaskDependency, deleteTaskDependency,
  cloneProject, getOptions, getBaskets,
  createPartnerAllocation, deletePartnerAllocation,
  getProjectExtensions, createProjectExtension, updateProjectExtension, deleteProjectExtension
} from '../api';
import {
  Project, Person, TASK_TYPES, TASK_LABELS, TaskType, OptionKind, OptionValue, ProjectExtension,
  TaskAllocation, TaskDependency, PartnerAllocation, SetPhasesRequest,
} from '../types';
import {
  estimateComparison, hasErrors, validateProjectForm, validateTaskForm, parentCandidates, subprojectSeed,
  type ProjectForm, type ProjectFormErrors, type TaskFormErrors, type TaskFormState, type TaskFormsState,
  DEFAULT_DAILY_RATE,
} from '@/lib/projectConfigModel';
import { isPhaseless, validatePhaselessTaskForm } from '@/lib/phasesMode';
import { ProjectListSidebar } from './admin-progetti/ProjectListSidebar';
import { NewProjectDialog } from './admin-progetti/NewProjectDialog';
import { ProjectDetailHeader } from './admin-progetti/ProjectDetailHeader';
import { GeneralSection, OfferSection, type ProjectField } from './admin-progetti/ProjectFormSections';
import { TasksSection, taskFieldKey, type TaskField } from './admin-progetti/TasksSection';
import { PhasesSection } from './admin-progetti/PhasesSection';
import { PartnerSection, ExtensionsSection, type ExtensionDraft } from './admin-progetti/PartnerAndExtensionsSections';
import { UndoToast, useUndoToast } from '@/components/app/UndoToast';
import { useAutosave } from './admin-progetti/useAutosave';

const OPTION_KINDS: OptionKind[] = ['societa', 'area', 'pm', 'status_offerta', 'partner'];

type PendingDeletion =
  | { kind: 'project'; project: Project }
  | { kind: 'task'; taskType: TaskType }
  | { kind: 'allocation'; taskType: TaskType; allocation: TaskAllocation };

const EMPTY_FORM: ProjectForm = {
  societa: '', area: '', pm_riferimento_cliente: '', name: '', description: '', codice_offerta: '',
  estimate_days: '', status: 'da lavorare', status_offerta: '', scala_da_basket: false, basket: '', exclude_from_actuals: false, icon: '',
  daily_rate: DEFAULT_DAILY_RATE, billing_type: 'turnkey', parent_project_id: '',
};

const defaultTaskForm = (): TaskFormState => ({
  enabled: false, status: 'not_started', planned_start: '', planned_end: '', estimated_days: '',
});

// GEN è un form solo per i progetti senza fasi (vuoto altrimenti).
const FORM_TASK_TYPES: TaskType[] = [...TASK_TYPES, 'GEN'];

const toProjectForm = (proj: Project): ProjectForm => ({
  societa: proj.societa || '',
  area: proj.area || '',
  pm_riferimento_cliente: proj.pm_riferimento_cliente || '',
  name: proj.name,
  description: proj.description || '',
  codice_offerta: proj.codice_offerta || '',
  estimate_days: proj.estimate_days?.toString() || '',
  status: proj.status,
  status_offerta: proj.status_offerta || '',
  scala_da_basket: proj.scala_da_basket ?? false,
  basket: proj.basket || '',
  exclude_from_actuals: proj.exclude_from_actuals ?? false,
  icon: proj.icon || '',
  daily_rate: proj.daily_rate?.toString() ?? DEFAULT_DAILY_RATE,
  billing_type: proj.billing_type ?? 'turnkey',
  parent_project_id: proj.parent_project_id?.toString() ?? '',
});

const toTaskForms = (proj: Project): TaskFormsState => {
  const forms: TaskFormsState = {};
  for (const tt of FORM_TASK_TYPES) forms[tt] = defaultTaskForm();
  for (const task of proj.tasks || []) {
    forms[task.task_type as TaskType] = {
      enabled: true,
      task_id: task.id,
      status: task.status,
      planned_start: task.planned_start || '',
      planned_end: task.planned_end || '',
      estimated_days: task.estimated_days?.toString() || '',
    };
  }
  return forms;
};

// La PUT /projects/{id} sostituisce tutte le colonne: si invia sempre lo snapshot completo.
const toProjectPayload = (form: ProjectForm) => ({
  societa: form.societa || undefined,
  area: form.area || undefined,
  pm_riferimento_cliente: form.pm_riferimento_cliente || undefined,
  name: form.name,
  description: form.description || undefined,
  codice_offerta: form.codice_offerta || undefined,
  estimate_days: form.estimate_days ? Number(form.estimate_days) : undefined,
  status: form.status,
  status_offerta: form.status_offerta || undefined,
  scala_da_basket: form.scala_da_basket,
  basket: form.scala_da_basket ? (form.basket || undefined) : undefined,
  exclude_from_actuals: form.exclude_from_actuals,
  icon: form.icon || null,
  daily_rate: Number(form.daily_rate),
  billing_type: form.billing_type,
  parent_project_id: form.parent_project_id ? Number(form.parent_project_id) : null,
});

const toTaskPayload = (taskType: TaskType, form: TaskFormState) => ({
  task_type: taskType,
  planned_start: form.planned_start || undefined,
  planned_end: form.planned_end || undefined,
  estimated_days: form.estimated_days ? Number(form.estimated_days) : undefined,
  status: form.status,
});

const messageOf = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

export default function AdminProgetti() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectExtensions, setProjectExtensions] = useState<ProjectExtension[]>([]);
  const [basketNames, setBasketNames] = useState<string[]>([]);
  const [optionValues, setOptionValues] = useState<Record<OptionKind, OptionValue[]>>({
    societa: [], area: [], pm: [], status_offerta: [], partner: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Form: lo stato guida il render, il ref dà ai salvataggi l'ultimo valore senza attendere il re-render.
  const [projForm, setProjFormState] = useState<ProjectForm>(EMPTY_FORM);
  const projFormRef = useRef<ProjectForm>(EMPTY_FORM);
  const [taskForms, setTaskFormsState] = useState<TaskFormsState>({});
  const taskFormsRef = useRef<TaskFormsState>({});
  // Ultimo stato confermato dal server: un blur senza modifiche non genera una PUT.
  const savedProjectRef = useRef<string>('');
  const savedTasksRef = useRef<Partial<Record<TaskType, string>>>({});
  const [projectErrors, setProjectErrors] = useState<ProjectFormErrors>({});
  const [taskErrors, setTaskErrors] = useState<Partial<Record<TaskType, TaskFormErrors>>>({});
  const [busyTask, setBusyTask] = useState<TaskType | null>(null);

  // Progetto mostrato ora: le risposte asincrone di un progetto lasciato vengono ignorate,
  // altrimenti selectedProject punterebbe ad A mentre i form contengono B (e la PUT completa sovrascriverebbe A).
  const currentProjectIdRef = useRef<number | null>(null);

  const setProjForm = (next: ProjectForm) => { projFormRef.current = next; setProjFormState(next); };
  const setTaskForms = (next: TaskFormsState) => { taskFormsRef.current = next; setTaskFormsState(next); };

  const hasInvalid = hasErrors(projectErrors) || Object.values(taskErrors).some(errors => !!errors && hasErrors(errors));
  // Modifiche digitate ma non ancora uscite dal campo: non sono in coda, ma chiudere la pagina le perderebbe.
  const isDirty = () => {
    if (currentProjectIdRef.current === null) return false;
    if (JSON.stringify(toProjectPayload(projFormRef.current)) !== savedProjectRef.current) return true;
    return FORM_TASK_TYPES.some(tt => {
      const form = taskFormsRef.current[tt];
      return !!form?.enabled && !!form.task_id && JSON.stringify(toTaskPayload(tt, form)) !== savedTasksRef.current[tt];
    });
  };
  const { state: saveState, queue } = useAutosave(() => hasInvalid || isDirty());
  const undoToast = useUndoToast();

  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [deleting, setDeleting] = useState(false);
  // L'errore va mostrato dentro il dialog: il banner di pagina resta coperto dall'overlay.
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const closeDeletion = () => { setPendingDeletion(null); setDeletionError(null); };
  const leaveResolver = useRef<((leave: boolean) => void) | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // null = dialog chiuso; seed = campi iniziali (vuoto per un progetto autonomo, padre per un sotto progetto).
  const [newProject, setNewProject] = useState<{ seed: Partial<Project>; parentName: string | null } | null>(null);
  const [cloneSourceId, setCloneSourceId] = useState<number | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);

  const loadProjects = async () => {
    const data = await getProjects();
    setProjects(data);
    return data;
  };

  const loadProjectDetail = useCallback(async (projId: number) => {
    const [proj, extensions] = await Promise.all([getProject(projId), getProjectExtensions(projId)]);
    currentProjectIdRef.current = projId;
    setSelectedProject(proj);
    setProjectExtensions(extensions);
    projFormRef.current = toProjectForm(proj);
    setProjFormState(projFormRef.current);
    taskFormsRef.current = toTaskForms(proj);
    setTaskFormsState(taskFormsRef.current);
    savedProjectRef.current = JSON.stringify(toProjectPayload(projFormRef.current));
    savedTasksRef.current = Object.fromEntries(FORM_TASK_TYPES.map(tt => [tt, JSON.stringify(toTaskPayload(tt, taskFormsRef.current[tt]!))]));
    setProjectErrors({});
    setTaskErrors({});
  }, []);

  // Un "Annulla" rimasto aperto riguarda il progetto precedente: si chiude cambiando progetto.
  const dismissUndo = undoToast.dismiss;
  useEffect(() => { dismissUndo(); }, [id, dismissUndo]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      queue.discard();
      try {
        const [projs] = await Promise.all([
          loadProjects(),
          getPersons().then(setPersons),
          getBaskets().then(list => setBasketNames(list.map(b => b.basket))).catch(() => undefined),
          ...OPTION_KINDS.map(k =>
            getOptions(k)
              .then(vals => setOptionValues(prev => ({ ...prev, [k]: vals })))
              .catch(() => undefined)),
        ]);
        if (id) {
          await loadProjectDetail(Number(id));
        } else if (projs.length > 0) {
          navigate(`/admin/progetti/${projs[0].id}`, { replace: true });
        } else {
          setSelectedProject(null);
        }
      } catch {
        setError('Errore nel caricamento');
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [id, loadProjectDetail, navigate, queue, reloadKey]);

  /** Ricarica allocazioni/dipendenze/totali senza toccare i form, che potrebbero avere modifiche in corso. */
  const refreshProjectData = async (projId: number) => {
    const [proj] = await Promise.all([getProject(projId), loadProjects()]);
    if (projId === currentProjectIdRef.current) setSelectedProject(proj);
  };

  // ---------- Uscita dal progetto con modifiche non salvate ----------

  const requestLeave = async (): Promise<boolean> => {
    await queue.flush();
    if (!queue.hasUnsaved() && !hasInvalid) return true;
    setLeaveDialogOpen(true);
    return new Promise(resolve => { leaveResolver.current = resolve; });
  };

  const resolveLeave = (leave: boolean) => {
    if (leave) {
      queue.discard();
      setProjectErrors({});
      setTaskErrors({});
    }
    setLeaveDialogOpen(false);
    leaveResolver.current?.(leave);
    leaveResolver.current = null;
  };

  const reloadAll = async () => {
    if (!(await requestLeave())) return;
    setError(null);
    setReloadKey(key => key + 1);
  };

  const handleSelectProject = async (proj: Project) => {
    if (proj.id === selectedProject?.id) return;
    if (!(await requestLeave())) return;
    setError(null);
    navigate(`/admin/progetti/${proj.id}`);
  };

  // ---------- Autosave progetto ----------

  const changeProject = (patch: Partial<ProjectForm>) => {
    setProjForm({ ...projFormRef.current, ...patch });
    const touched = Object.keys(patch) as ProjectField[];
    if (touched.includes('name')) setProjectErrors(e => ({ ...e, name: undefined }));
    if (touched.includes('estimate_days')) setProjectErrors(e => ({ ...e, estimateDays: undefined }));
    if (touched.includes('daily_rate')) setProjectErrors(e => ({ ...e, dailyRate: undefined }));
    if (touched.some(f => f === 'billing_type' || f === 'scala_da_basket' || f === 'exclude_from_actuals')) setProjectErrors(e => ({ ...e, billingType: undefined }));
    if (touched.some(f => f === 'parent_project_id' || f === 'billing_type' || f === 'scala_da_basket')) {
      setProjectErrors(e => ({ ...e, parentProject: undefined }));
    }
  };

  const commitProject = (field: ProjectField, patch?: Partial<ProjectForm>) => {
    if (!selectedProject) return;
    const next = patch ? { ...projFormRef.current, ...patch } : projFormRef.current;
    if (patch) setProjForm(next);
    const errors = validateProjectForm(next);
    setProjectErrors(errors);
    if (hasErrors(errors)) return;
    const payload = toProjectPayload(next);
    const snapshot = JSON.stringify(payload);
    if (snapshot === savedProjectRef.current) return;
    const projectId = selectedProject.id;
    queue.push({
      key: 'project',
      field,
      run: async () => {
        try {
          await updateProject(projectId, payload);
        } catch (err) {
          // Il server ha rifiutato modalità o padre: i select tornano all'ultimo valore salvato.
          if (field === 'billing_type' || field === 'parent_project_id') {
            const saved = JSON.parse(savedProjectRef.current) as ReturnType<typeof toProjectPayload>;
            setProjForm({
              ...projFormRef.current,
              billing_type: saved.billing_type,
              parent_project_id: saved.parent_project_id?.toString() ?? '',
            });
          }
          throw err;
        }
        savedProjectRef.current = snapshot;
        // Prima del reload: se loadProjects fallisce dopo un PUT riuscito, il billing non resta stantio.
        setSelectedProject(prev => prev?.id === projectId ? { ...prev, billing_type: payload.billing_type } : prev);
        const list = await loadProjects();
        const fresh = list.find(p => p.id === projectId);
        if (fresh && projectId === currentProjectIdRef.current) {
          setSelectedProject(prev => prev && prev.id === projectId ? {
            ...prev, total_stima: fresh.total_stima, total_stima_own: fresh.total_stima_own, total_partner_days: fresh.total_partner_days,
          } : prev);
        }
      },
    });
  };

  // ---------- Task ----------

  const changeTask = (taskType: TaskType, patch: Partial<TaskFormState>) => {
    const current = taskFormsRef.current[taskType] ?? defaultTaskForm();
    setTaskForms({ ...taskFormsRef.current, [taskType]: { ...current, ...patch } });
    setTaskErrors(errors => ({ ...errors, [taskType]: undefined }));
  };

  const commitTask = (taskType: TaskType, field: TaskField, patch?: Partial<TaskFormState>) => {
    if (patch) changeTask(taskType, patch);
    const form = taskFormsRef.current[taskType];
    if (!form?.enabled || !form.task_id) return;
    const errors = taskType === 'GEN' ? validatePhaselessTaskForm(form) : validateTaskForm(form);
    setTaskErrors(prev => ({ ...prev, [taskType]: hasErrors(errors) ? errors : undefined }));
    if (hasErrors(errors)) return;
    const payload = toTaskPayload(taskType, form);
    const snapshot = JSON.stringify(payload);
    if (snapshot === savedTasksRef.current[taskType]) return;
    const taskId = form.task_id;
    queue.push({
      key: `task:${taskType}`,
      field: taskFieldKey(taskType, field),
      run: async () => {
        await updateTask(taskId, payload);
        savedTasksRef.current = { ...savedTasksRef.current, [taskType]: snapshot };
      },
    });
  };

  const toggleTask = async (taskType: TaskType, enabled: boolean) => {
    if (!selectedProject) return;
    const form = taskFormsRef.current[taskType] ?? defaultTaskForm();
    if (!enabled) {
      if (form.task_id) setPendingDeletion({ kind: 'task', taskType });
      else changeTask(taskType, { enabled: false });
      return;
    }
    changeTask(taskType, { enabled: true });
    setBusyTask(taskType);
    try {
      const created = await createTask(selectedProject.id, toTaskPayload(taskType, form));
      changeTask(taskType, { enabled: true, task_id: created.id });
      savedTasksRef.current = { ...savedTasksRef.current, [taskType]: JSON.stringify(toTaskPayload(taskType, form)) };
      await refreshProjectData(selectedProject.id);
    } catch (err) {
      changeTask(taskType, { enabled: false });
      setError(messageOf(err, `Errore nella creazione del task ${TASK_LABELS[taskType]}`));
    } finally {
      setBusyTask(null);
    }
  };

  const addAllocation = async (taskType: TaskType, personId: number, days: number) => {
    const taskId = taskFormsRef.current[taskType]?.task_id;
    if (!taskId || !selectedProject) return false;
    try {
      await upsertAllocation(taskId, { person_id: personId, estimated_days: days });
      await refreshProjectData(selectedProject.id);
      return true;
    } catch (err) {
      setError(messageOf(err, 'Errore nell’aggiunta dell’allocazione'));
      return false;
    }
  };

  /** null = fatto; stringa = errore da mostrare nel dialog di PhasesSection. */
  const replaceAllocation = async (personId: number, days: number): Promise<string | null> => {
    const taskId = taskFormsRef.current.GEN?.task_id;
    if (!taskId || !selectedProject) return 'Impossibile cambiare la persona assegnata.';
    try {
      await upsertAllocation(taskId, { person_id: personId, estimated_days: days, replace: true });
      await refreshProjectData(selectedProject.id);
      return null;
    } catch (err) {
      return messageOf(err, 'Errore nel cambio della persona assegnata');
    }
  };

  /** null = fatto; stringa = errore da mostrare nel dialog di PhasesSection. */
  const setPhases = async (request: SetPhasesRequest): Promise<string | null> => {
    if (!selectedProject) return 'Nessun progetto selezionato';
    const projectId = selectedProject.id;
    try {
      await queue.flush();
      await setProjectPhases(projectId, request);
      await Promise.all([loadProjectDetail(projectId), loadProjects()]);
      return null;
    } catch (err) {
      return messageOf(err, 'Errore nel cambio di modalità delle fasi');
    }
  };

  const addDependency = async (taskType: TaskType, predecessorTaskId: number) => {
    const taskId = taskFormsRef.current[taskType]?.task_id;
    if (!taskId || !selectedProject) return false;
    try {
      await addTaskDependency(taskId, predecessorTaskId);
      await refreshProjectData(selectedProject.id);
      return true;
    } catch (err) {
      setError(messageOf(err, 'Errore nell’aggiunta della dipendenza'));
      return false;
    }
  };

  // ---------- Rimozioni con "Annulla" (solo righe senza dati collegati) ----------

  const removeWithUndo = async (remove: () => Promise<unknown>, restore: () => Promise<unknown>, reload: () => Promise<unknown>, message: string) => {
    try {
      await remove();
      await reload();
      undoToast.show({
        message,
        undo: async () => {
          try {
            await restore();
            await reload();
          } catch (err) {
            setError(messageOf(err, 'Ripristino non riuscito'));
          }
        },
      });
    } catch (err) {
      setError(messageOf(err, 'Errore durante l’eliminazione'));
    }
  };

  const removeDependency = (dependency: TaskDependency, predecessorLabel: string) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    void removeWithUndo(
      () => deleteTaskDependency(dependency.id),
      () => addTaskDependency(dependency.successor_task_id, dependency.predecessor_task_id),
      () => refreshProjectData(projectId),
      `Dipendenza da ${predecessorLabel} rimossa`,
    );
  };

  const addPartner = async (societa: string, giornate: number) => {
    if (!selectedProject) return false;
    try {
      await createPartnerAllocation({ project_id: selectedProject.id, societa, giornate });
      await refreshProjectData(selectedProject.id);
      return true;
    } catch (err) {
      setError(messageOf(err, 'Errore nell’aggiunta delle giornate altri partner'));
      return false;
    }
  };

  const removePartner = (row: PartnerAllocation) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    void removeWithUndo(
      () => deletePartnerAllocation(row.id),
      () => createPartnerAllocation({ project_id: projectId, societa: row.societa, giornate: row.giornate }),
      () => refreshProjectData(projectId),
      `giornate partner di ${row.societa} rimosse`,
    );
  };

  const reloadExtensions = async (projectId: number) => {
    const [extensions] = await Promise.all([getProjectExtensions(projectId), refreshProjectData(projectId)]);
    if (projectId === currentProjectIdRef.current) setProjectExtensions(extensions);
  };

  const saveExtension = async (extensionId: number | null, draft: ExtensionDraft) => {
    if (!selectedProject) return false;
    const data = {
      project_id: selectedProject.id,
      codice_offerta: draft.codice_offerta.trim() || undefined,
      giornate: Number(draft.giornate),
      status_offerta: draft.status_offerta || undefined,
    };
    try {
      if (extensionId === null) await createProjectExtension(data);
      else await updateProjectExtension(extensionId, data);
      await reloadExtensions(selectedProject.id);
      return true;
    } catch (err) {
      setError(messageOf(err, 'Errore nel salvataggio dell’estensione'));
      return false;
    }
  };

  const removeExtension = (extension: ProjectExtension) => {
    if (!selectedProject) return;
    const projectId = selectedProject.id;
    void removeWithUndo(
      () => deleteProjectExtension(extension.id),
      () => createProjectExtension({
        project_id: projectId,
        codice_offerta: extension.codice_offerta,
        giornate: extension.giornate,
        status_offerta: extension.status_offerta,
      }),
      () => reloadExtensions(projectId),
      `Estensione ${extension.codice_offerta || 'senza codice'} rimossa`,
    );
  };

  // ---------- Progetto: crea, duplica, elimina ----------

  const handleCreateProject = async (name: string) => {
    if (!newProject || !(await requestLeave())) return;
    const proj = await createProject({ ...newProject.seed, name, icon: null });
    setNewProject(null);
    navigate(`/admin/progetti/${proj.id}`);
  };

  const handleCloneProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSourceId || !cloneName.trim()) return;
    if (!(await requestLeave())) return;
    setCloning(true);
    try {
      const proj = await cloneProject(cloneSourceId, cloneName.trim());
      setCloneSourceId(null);
      setCloneName('');
      navigate(`/admin/progetti/${proj.id}`);
    } catch {
      setError('Errore nella duplicazione del progetto');
    } finally {
      setCloning(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!pendingDeletion || !selectedProject) return;
    setDeleting(true);
    setDeletionError(null);
    try {
      if (pendingDeletion.kind === 'project') {
        queue.discard();
        await deleteProject(pendingDeletion.project.id);
        const remaining = await loadProjects();
        if (remaining.length > 0) {
          navigate(`/admin/progetti/${remaining[0].id}`);
        } else {
          setSelectedProject(null);
          navigate('/admin/progetti');
        }
      } else if (pendingDeletion.kind === 'task') {
        const taskId = taskFormsRef.current[pendingDeletion.taskType]?.task_id;
        // Una PUT in coda su questo task fallirebbe dopo la DELETE: si attende quella in volo e si toglie il resto.
        await queue.flush();
        queue.drop(`task:${pendingDeletion.taskType}`);
        if (taskId) await deleteTask(taskId);
        setTaskForms({ ...taskFormsRef.current, [pendingDeletion.taskType]: defaultTaskForm() });
        setTaskErrors(errors => ({ ...errors, [pendingDeletion.taskType]: undefined }));
        await refreshProjectData(selectedProject.id);
      } else {
        const taskId = taskFormsRef.current[pendingDeletion.taskType]?.task_id;
        if (taskId) await deleteAllocation(taskId, pendingDeletion.allocation.person_id);
        await refreshProjectData(selectedProject.id);
      }
      closeDeletion();
    } catch (err) {
      setDeletionError(messageOf(err, 'Errore durante l’eliminazione'));
    } finally {
      setDeleting(false);
    }
  };

  const deletion = (() => {
    if (!pendingDeletion) return { title: '', text: '', action: '' };
    if (pendingDeletion.kind === 'project') {
      return {
        title: 'Eliminare il progetto?',
        text: `“${pendingDeletion.project.name}” verrà eliminato con task, allocazioni e pianificazione. L’operazione è irreversibile.`,
        action: 'Elimina progetto',
      };
    }
    if (pendingDeletion.kind === 'task') {
      const task = selectedProject?.tasks?.find(t => t.task_type === pendingDeletion.taskType);
      return {
        title: `Disattivare ${TASK_LABELS[pendingDeletion.taskType]}?`,
        text: `Il task verrà eliminato subito con ${task?.allocations.length ?? 0} allocazioni, la pianificazione settimanale e le dipendenze. L’operazione è irreversibile.`,
        action: 'Disattiva task',
      };
    }
    const from = pendingDeletion.taskType === 'GEN' ? 'dal progetto' : `da ${TASK_LABELS[pendingDeletion.taskType]}`;
    return {
      title: 'Rimuovere l’allocazione?',
      text: `Rimuoverai ${pendingDeletion.allocation.person_name} ${from}, insieme alla sua pianificazione settimanale. L’operazione è irreversibile.`,
      action: 'Rimuovi',
    };
  })();

  // ---------- Render ----------

  const enabledTaskCount = TASK_TYPES.filter(tt => taskForms[tt]?.enabled).length;
  const sections = [
    { id: 'sezione-generale', label: 'Generale' },
    { id: 'sezione-offerta', label: 'Offerta' },
    { id: 'sezione-task', label: 'Task', count: selectedProject && isPhaseless(selectedProject) ? undefined : enabledTaskCount },
    { id: 'sezione-partner', label: 'Giornate altri partner', count: selectedProject?.partner_allocations?.length },
    { id: 'sezione-estensioni', label: 'Estensioni', count: projectExtensions.length },
  ];
  const subtitle = [projForm.codice_offerta, projForm.scala_da_basket ? `basket ${projForm.basket}` : `${projForm.estimate_days || 0} gg stimati`].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-background lg:flex">
      <ProjectListSidebar
        projects={projects}
        selectedId={selectedProject?.id ?? null}
        onSelect={project => void handleSelectProject(project)}
        onCreate={() => setNewProject({ seed: {}, parentName: null })}
      />

      <main className="min-w-0 flex-1">
        {loading && <LoadingState label="Aggiornamento della configurazione progetto…" className="py-2" />}
        {error && (
          <div className="m-4 sm:m-6 lg:m-8">
            <ErrorBanner onRetry={() => void reloadAll()}>{error}</ErrorBanner>
          </div>
        )}
        {!selectedProject ? (
          !loading && (
            <div className="flex min-h-64 items-center justify-center p-6 text-center">
              <div>
                <p className="mb-3 text-muted-foreground">Nessun progetto selezionato</p>
                <Button variant="link" onClick={() => setNewProject({ seed: {}, parentName: null })}>Crea un nuovo progetto</Button>
              </div>
            </div>
          )
        ) : (
          <>
            <ProjectDetailHeader
              projectId={selectedProject.id}
              name={projForm.name}
              icon={projForm.icon}
              status={projForm.status}
              subtitle={subtitle}
              saveState={saveState}
              hasInvalid={hasInvalid}
              sections={sections}
              onRetry={() => queue.retry()}
              onDuplicate={() => { setCloneSourceId(selectedProject.id); setCloneName(`Copia di ${projForm.name}`); }}
              onDelete={() => setPendingDeletion({ kind: 'project', project: selectedProject })}
              subprojects={selectedProject.children}
              onOpenProject={childId => {
                const child = projects.find(p => p.id === childId);
                if (child) void handleSelectProject(child);
              }}
              onNewSubproject={projForm.billing_type === 'tm'
                ? () => setNewProject({ seed: subprojectSeed(selectedProject.id, projForm), parentName: projForm.name })
                : undefined}
            />
            {/* key: azzera lo stato locale dei figli (bozze estensione, predecessori, righe aperte) al cambio progetto. */}
            <div key={selectedProject.id} className="max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
              <div id="sezione-generale" className="scroll-mt-36">
                <GeneralSection
                  form={projForm}
                  errors={projectErrors}
                  failedField={saveState.failedKey === 'project' ? saveState.failedField : null}
                  onChange={changeProject}
                  onCommit={commitProject}
                  options={optionValues}
                />
              </div>
              <div id="sezione-offerta" className="scroll-mt-36">
                <OfferSection
                  form={projForm}
                  errors={projectErrors}
                  failedField={saveState.failedKey === 'project' ? saveState.failedField : null}
                  billingError={saveState.failedKey === 'project' && saveState.failedField === 'billing_type' ? saveState.error : null}
                  onChange={changeProject}
                  onCommit={commitProject}
                  statusOfferta={optionValues.status_offerta}
                  basketNames={basketNames}
                  estimate={estimateComparison(projForm.estimate_days, taskForms)}
                  parentOptions={parentCandidates(projects, selectedProject.id)}
                  hasChildren={(selectedProject.children?.length ?? 0) > 0}
                  parentError={saveState.failedKey === 'project' && saveState.failedField === 'parent_project_id' ? saveState.error : null}
                />
              </div>
              <div id="sezione-task" className="scroll-mt-36">
                <div className="space-y-6">
                  {!selectedProject.is_virtual && <PhasesSection
                    project={selectedProject}
                    billingType={selectedProject.billing_type ?? 'turnkey'}
                    persons={persons}
                    genForm={taskForms.GEN ?? defaultTaskForm()}
                    genErrors={taskErrors.GEN ?? {}}
                    failedField={saveState.failedField}
                    onChangeGen={patch => changeTask('GEN', patch)}
                    onCommitGen={field => commitTask('GEN', field)}
                    onAddPerson={(personId, days) => addAllocation('GEN', personId, days)}
                    onChangePerson={replaceAllocation}
                    onRemoveAllocation={allocation => setPendingDeletion({ kind: 'allocation', taskType: 'GEN', allocation })}
                    onSetPhases={setPhases}
                  />}
                  {!isPhaseless(selectedProject) && (
                    <TasksSection
                      project={selectedProject}
                      persons={persons}
                      taskForms={taskForms}
                      taskErrors={taskErrors}
                      failedField={saveState.failedField}
                      busyTask={busyTask}
                      onToggle={(taskType, enabled) => void toggleTask(taskType, enabled)}
                      onChange={changeTask}
                      onCommit={commitTask}
                      onAddAllocation={addAllocation}
                      onRemoveAllocation={(taskType, allocation) => setPendingDeletion({ kind: 'allocation', taskType, allocation })}
                      onAddDependency={addDependency}
                      onRemoveDependency={removeDependency}
                    />
                  )}
                </div>
              </div>
              <div id="sezione-partner" className="scroll-mt-36">
                <PartnerSection project={selectedProject} partnerOptions={optionValues.partner} onAdd={addPartner} onRemove={removePartner} />
              </div>
              <div id="sezione-estensioni" className="scroll-mt-36">
                <ExtensionsSection
                  billingType={projForm.billing_type}
                  extensions={projectExtensions}
                  statusOptions={optionValues.status_offerta}
                  onSave={saveExtension}
                  onRemove={removeExtension}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <UndoToast notice={undoToast.notice} onDismiss={undoToast.dismiss} />

      <Dialog open={leaveDialogOpen} onOpenChange={isOpen => !isOpen && resolveLeave(false)}>
        <DialogContent className="rounded-card sm:max-w-[480px]">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>Modifiche non salvate</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Alcune modifiche a questo progetto non sono state salvate (campi non validi o errore di rete). Se prosegui andranno perse.
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => resolveLeave(false)}>Resta e correggi</Button>
            <Button type="button" variant="destructive" onClick={() => resolveLeave(true)}>Scarta modifiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDeletion !== null} onOpenChange={isOpen => !isOpen && !deleting && closeDeletion()}>
        <DialogContent className="rounded-card sm:max-w-[480px]" showClose={!deleting}>
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>{deletion.title}</DialogTitle>
          </DialogHeader>
          <DialogDescription>{deletion.text}</DialogDescription>
          {deletionError && <ErrorBanner>{deletionError}</ErrorBanner>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={closeDeletion}>Annulla</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void handleConfirmDeletion()}>
              {deleting ? 'Eliminazione…' : deletion.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneSourceId !== null} onOpenChange={isOpen => !isOpen && setCloneSourceId(null)}>
        <DialogContent className="rounded-card sm:max-w-[480px]">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>Duplica progetto</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Verranno copiati solo i task (tipo e giorni stimati). Allocazioni, WBS e giorni consuntivati non vengono copiati.
          </DialogDescription>
          <form onSubmit={handleCloneProject} className="space-y-4">
            <Field required>
              <FieldLabel>Nome del nuovo progetto</FieldLabel>
              <Input type="text" required autoFocus value={cloneName} onChange={e => setCloneName(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCloneSourceId(null)}>Annulla</Button>
              <Button type="submit" disabled={cloning || !cloneName.trim()}>{cloning ? 'Duplicazione…' : 'Duplica'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <NewProjectDialog
        open={newProject !== null}
        parentName={newProject?.parentName ?? null}
        onOpenChange={open => { if (!open) setNewProject(null); }}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
