import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AddableActivity } from '../../lib/consuntivazioneOptimistic';
import { SIDEBAR_COL } from '../timeline/layout';

interface Props {
  activities: AddableActivity[];
  disabled: boolean;
  /** Errore di caricamento dei progetti selezionabili, con retry. */
  error: string | null;
  onRetry: () => void;
  onAdd: (activity: AddableActivity) => void;
  /** Suggerimento per il member: vede solo i progetti assegnati. */
  hint: string;
}

/** Riga finale della griglia: si cerca l'attività e la riga compare vuota, pronta per le ore. */
export default function AddActivityRow({ activities, disabled, error, onRetry, onAdd, hint }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex border-b border-border">
      <div className={cn(SIDEBAR_COL, 'flex items-center gap-2 px-3 py-2')}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={disabled} aria-label="Aggiungi attività">
              <Plus aria-hidden="true" /> Aggiungi attività
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <Command
              onSelect={value => {
                const activity = activities.find(a => a.key === value);
                if (activity) onAdd(activity);
                setOpen(false);
              }}
            >
              <CommandInput placeholder="Cerca progetto o attività…" />
              <CommandList>
                <CommandEmpty>{hint}</CommandEmpty>
                {activities.map(activity => (
                  <CommandItem key={activity.key} value={activity.key} keywords={[activity.label]}>
                    {activity.label}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {error && (
          <span role="alert" className="flex items-center gap-2 text-xs text-destructive">
            {error}
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>Riprova</Button>
          </span>
        )}
      </div>
    </div>
  );
}
