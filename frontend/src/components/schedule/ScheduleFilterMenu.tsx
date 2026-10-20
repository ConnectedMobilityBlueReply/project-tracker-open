import { Funnel } from '@phosphor-icons/react';
import type { SchedulePerson } from '../../types';
import { EMPTY_FILTERS } from '../../lib/scheduleModel';
import type { ScheduleFilters } from '../../lib/scheduleModel';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface ProjectOption {
  id: number;
  name: string;
}

interface Props {
  filters: ScheduleFilters;
  persons: SchedulePerson[];
  projects: ProjectOption[];
  onChange: (filters: ScheduleFilters) => void;
}

/** Toggle di un id nella lista: un array vuoto significa "tutti". */
function toggle(selected: number[], id: number): number[] {
  return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
}

export default function ScheduleFilterMenu({ filters, persons, projects, onChange }: Props) {
  const teams = [...new Set(persons.map(p => p.team_id))].sort((left, right) => left - right);
  const activeCount =
    filters.projectIds.length + filters.personIds.length + filters.teamIds.length
    + (filters.hideEmpty ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Funnel className="mr-1 h-4 w-4" />
          Filtri{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-96 w-72 overflow-y-auto space-y-3">
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Progetti</h3>
          {projects.map(project => (
            <label key={project.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.projectIds.includes(project.id)}
                onChange={() =>
                  onChange({ ...filters, projectIds: toggle(filters.projectIds, project.id) })}
              />
              <span className="truncate">{project.name}</span>
            </label>
          ))}
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Persone</h3>
          {persons.map(person => (
            <label key={person.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.personIds.includes(person.id)}
                onChange={() =>
                  onChange({ ...filters, personIds: toggle(filters.personIds, person.id) })}
              />
              <span className="truncate">{person.name}</span>
            </label>
          ))}
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">Team</h3>
          {teams.map(teamId => (
            <label key={teamId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.teamIds.includes(teamId)}
                onChange={() => onChange({ ...filters, teamIds: toggle(filters.teamIds, teamId) })}
              />
              <span>Team {teamId}</span>
            </label>
          ))}
        </section>

        <label className="flex items-center gap-2 border-t pt-2 text-sm">
          <input
            type="checkbox"
            checked={filters.hideEmpty}
            onChange={event => onChange({ ...filters, hideEmpty: event.target.checked })}
          />
          Nascondi chi non ha allocazioni
        </label>

        <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(EMPTY_FILTERS)}>
          Azzera i filtri
        </Button>
      </PopoverContent>
    </Popover>
  );
}
