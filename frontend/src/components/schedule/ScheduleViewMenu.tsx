import { Button } from '../ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { SortKey } from '../../lib/scheduleModel';
import type { Density, ScheduleView } from './ScheduleToolbar';

interface Props {
  view: ScheduleView;
  sort: { key: SortKey; descending: boolean };
  density: Density;
  onSortChange: (sort: { key: SortKey; descending: boolean }) => void;
  onDensityChange: (density: Density) => void;
}

/** Ordinamento e densità: preferenze di vista, fuori dalla riga principale della toolbar. */
export default function ScheduleViewMenu({ view, sort, density, onSortChange, onDensityChange }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">Vista</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {view === 'person' && (
          <>
            <DropdownMenuLabel>Ordina per</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort.key}
              onValueChange={value => onSortChange({ ...sort, key: value as SortKey })}
            >
              <DropdownMenuRadioItem value="name">Nome</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="unscheduled">Non allocati</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="utilization">Utilizzo</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuCheckboxItem
              checked={sort.descending}
              onCheckedChange={checked => onSortChange({ ...sort, descending: checked === true })}
            >
              Ordine inverso
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Densità</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={value => onDensityChange(value as Density)}
        >
          <DropdownMenuRadioItem value="comfortable">Ampia</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">Compatta</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
