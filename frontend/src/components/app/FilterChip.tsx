import { useState } from 'react';
import { CaretDown, Check, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  /** Valore scelto; stringa vuota = nessun filtro. */
  value: string;
  options: readonly string[];
  /** Se presente, prima riga dell'elenco che azzera il filtro (es. "Tutte le aree"). */
  allLabel?: string;
  onChange: (value: string) => void;
}

/** Chip di filtro a selezione singola: apre un elenco ricercabile, la X accanto lo azzera. */
export function FilterChip({ label, value, options, allLabel, onChange }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const active = value !== '';
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <span className={cn('inline-flex items-center rounded-md border', active ? 'border-primary/40 bg-primary/10' : 'border-border')}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" aria-label={active ? `${label}: ${value}` : `Filtra per ${label}`}>
            {label}
            {active && <span className="font-semibold text-primary">: {value}</span>}
            <CaretDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <Command onSelect={next => next !== allLabel && choose(next)}>
            <CommandInput placeholder={`Cerca ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>Nessuna opzione</CommandEmpty>
              {allLabel && (
                <CommandItem value={allLabel} onSelect={() => choose('')}>
                  {allLabel}
                  {!active && <Check aria-hidden="true" className="ml-auto" />}
                </CommandItem>
              )}
              {options.map(option => (
                <CommandItem key={option} value={option}>
                  {option}
                  {option === value && <Check aria-hidden="true" className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {active && (
        <Button type="button" variant="ghost" size="sm" iconOnly aria-label={`Rimuovi filtro ${label}`} onClick={() => onChange('')}>
          <X aria-hidden="true" />
        </Button>
      )}
    </span>
  );
}
