import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AvatarFallback, AvatarRoot } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { avatarColorFor, initials } from '@/lib/people';
import { dueDateFormat } from '../../lib/planningModel';
import {
  TASK_LABELS, WBS_PRIORITY_LABELS, WBS_PRIORITY_OPTIONS, WBS_STATUS_LABELS, WBS_STATUS_OPTIONS,
  type TaskType, type WbsPlanningItem, type WbsPriority, type WbsStatus,
} from '../../types';
import { PRIORITY_CELL, STATUS_CELL } from './planningStyles';

export function taskLabel(item: WbsPlanningItem): string {
  return `${item.project_name} · ${TASK_LABELS[item.task_type as TaskType] ?? item.task_type}`;
}

export function formatDue(iso?: string | null): string {
  return iso
    ? format(new Date(`${iso}T00:00:00`), dueDateFormat(iso, new Date().getFullYear()), { locale: it })
    : '—';
}

export function OwnerAvatar({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <AvatarRoot size="sm" color={avatarColorFor(name)} role="img" aria-label={name} title={name}>
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </AvatarRoot>
  );
}

const CELL = 'flex h-full w-full items-center justify-center px-2 text-xs font-medium';

/** Cella tinta; con permesso diventa il trigger di un menu (tastiera e touch inclusi). */
function ChoiceCell<T extends string>({ value, label, tone, options, labels, editable, ariaLabel, onChange }: {
  value: T;
  label: string;
  tone: string;
  options: readonly T[];
  labels: Record<T, string>;
  editable: boolean;
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  if (!editable) return <div className={cn(CELL, tone)}>{label}</div>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={cn(CELL, tone, 'hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}>
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {options.map(option => (
          <DropdownMenuItem key={option} disabled={option === value} onSelect={() => onChange(option)}>
            {labels[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StatusCell({ item, editable, onChange }: {
  item: WbsPlanningItem;
  editable: boolean;
  onChange: (status: WbsStatus) => void;
}) {
  return (
    <ChoiceCell
      value={item.status}
      label={WBS_STATUS_LABELS[item.status]}
      tone={STATUS_CELL[item.status]}
      options={WBS_STATUS_OPTIONS}
      labels={WBS_STATUS_LABELS}
      editable={editable}
      ariaLabel={`Stato di ${item.name}: ${WBS_STATUS_LABELS[item.status]}. Cambia stato`}
      onChange={onChange}
    />
  );
}

export function PriorityCell({ item, editable, onChange }: {
  item: WbsPlanningItem;
  editable: boolean;
  onChange: (priority: WbsPriority) => void;
}) {
  return (
    <ChoiceCell
      value={item.priority}
      label={WBS_PRIORITY_LABELS[item.priority]}
      tone={PRIORITY_CELL[item.priority]}
      options={WBS_PRIORITY_OPTIONS}
      labels={WBS_PRIORITY_LABELS}
      editable={editable}
      ariaLabel={`Priorità di ${item.name}: ${WBS_PRIORITY_LABELS[item.priority]}. Cambia priorità`}
      onChange={onChange}
    />
  );
}
