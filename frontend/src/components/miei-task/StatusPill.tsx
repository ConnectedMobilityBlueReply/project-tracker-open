import { Check } from '@phosphor-icons/react';
import { useState } from 'react';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WBS_STATUS_TONE } from '@/lib/statusTone';
import { WBS_STATUS_LABELS, WBS_STATUS_OPTIONS, type WbsStatus } from '@/types';

interface Props {
  status: WbsStatus;
  disabled: boolean;
  /** Etichetta accessibile: "Stato di <nome task>". */
  label: string;
  onChange: (status: WbsStatus) => void;
}

/** Stato come chip: un clic apre le tre opzioni, un clic sceglie. */
export function StatusPill({ status, disabled, label, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={`${label}: ${WBS_STATUS_LABELS[status]}`} className="rounded-full focus-visible:outline-2 focus-visible:outline-ring">
          <StatusBadge tone={WBS_STATUS_TONE[status]} size="sm">{WBS_STATUS_LABELS[status]}</StatusBadge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        <div role="group" aria-label={label}>
          {WBS_STATUS_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={option === status}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              onClick={() => { setOpen(false); if (option !== status) onChange(option); }}
            >
              {WBS_STATUS_LABELS[option]}
              {option === status && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
