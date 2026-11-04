import type { ReactNode } from 'react';
import { CalendarX, UserCheck, WarningCircle } from '@phosphor-icons/react';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { formatDays, formatIsoDate, formatIsoShort } from '@/lib/buModel';
import {
  formatExcessDays, freeEntries, overallocatedEntries, uncoveredEntries,
  type FreeEntry, type OverEntry, type UncoveredEntry,
} from '@/lib/buDashboardModel';
import type { BuPerson } from '@/types';
import { AVAILABILITY_WEEKS, type BuSource } from './useBuDashboardData';

interface AvailabilityListsProps {
  people: BuSource<BuPerson[]>;
}

function PersonLine({ person, trailing }: { person: BuPerson; trailing: ReactNode }) {
  const teams = person.teams.map(team => team.name).join(', ');
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
        {teams && <p className="truncate text-xs text-muted-foreground">{teams}</p>}
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums">{trailing}</div>
    </div>
  );
}

function FreeRow({ entry }: { entry: FreeEntry }) {
  return (
    <li className="space-y-2 px-5 py-3">
      <PersonLine person={entry.person} trailing={<span className="font-medium">{formatDays(entry.total_free_days)} gg</span>} />
      <dl className="grid grid-cols-4 gap-2 text-xs">
        {entry.weeks.map(week => (
          <div key={week.week_start}>
            <dt className="text-muted-foreground">sett. {formatIsoShort(week.week_start)}</dt>
            <dd className="tabular-nums text-foreground">{formatDays(week.free_days)} gg</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function OverRow({ entry }: { entry: OverEntry }) {
  return (
    <li className="px-5 py-3">
      <PersonLine
        person={entry.person}
        trailing={<span className="font-medium text-destructive">{formatExcessDays(entry.excess_days)}</span>}
      />
      <p className="mt-1 text-xs text-muted-foreground">Settimana peggiore: sett. {formatIsoShort(entry.worst_week)}</p>
    </li>
  );
}

function UncoveredRow({ entry }: { entry: UncoveredEntry }) {
  return (
    <li className="px-5 py-3">
      <PersonLine person={entry.person} trailing={null} />
      <p className="mt-1 text-xs text-muted-foreground">Lavora fino alla sett. del {formatIsoDate(entry.allocated_until)}</p>
    </li>
  );
}

interface AvailabilityCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  source: BuSource<BuPerson[]>;
  count: number;
  emptyText: string;
  children: ReactNode;
}

/** Una lista della disponibilità: caricamento, errore con retry, vuoto o righe. */
function AvailabilityCard({ title, description, icon, source, count, emptyText, children }: AvailabilityCardProps) {
  let body: ReactNode;
  if (source.error != null) {
    body = <div className="p-4"><ErrorBanner onRetry={source.reload}>{source.error}</ErrorBanner></div>;
  } else if (source.data == null) {
    body = <LoadingState label="Caricamento disponibilità…" />;
  } else if (count === 0) {
    body = <EmptyState title={emptyText} bordered={false} />;
  } else {
    body = <ul className="divide-y divide-border">{children}</ul>;
  }
  return (
    <SectionCard title={title} description={description} icon={icon} bodyClassName="p-0">
      {body}
    </SectionCard>
  );
}

/** Tre liste affiancate da `lg`: liberi, sovrallocati e senza lavoro dopo sulla stessa finestra di 4 settimane. */
export function AvailabilityLists({ people }: AvailabilityListsProps) {
  const personList = people.data ?? [];
  const free = freeEntries(personList);
  const over = overallocatedEntries(personList);
  const uncovered = uncoveredEntries(personList);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AvailabilityCard
        title="Liberi"
        description="Giorni liberi per settimana"
        icon={<UserCheck />}
        source={people}
        count={free.length}
        emptyText={`Nessuno libero nelle prossime ${AVAILABILITY_WEEKS} settimane`}
      >
        {free.map(entry => <FreeRow key={entry.person.person_id} entry={entry} />)}
      </AvailabilityCard>
      <AvailabilityCard
        title="Sovrallocati"
        description="Giorni allocati oltre la capacità"
        icon={<WarningCircle />}
        source={people}
        count={over.length}
        emptyText={`Nessuno sovrallocato nelle prossime ${AVAILABILITY_WEEKS} settimane`}
      >
        {over.map(entry => <OverRow key={entry.person.person_id} entry={entry} />)}
      </AvailabilityCard>
      <AvailabilityCard
        title="Senza lavoro dopo"
        description="Lavorano ora, ma non fino all'ultima settimana"
        icon={<CalendarX />}
        source={people}
        count={uncovered.length}
        emptyText={`Nessuno senza lavoro dopo le prossime ${AVAILABILITY_WEEKS} settimane`}
      >
        {uncovered.map(entry => <UncoveredRow key={entry.person.person_id} entry={entry} />)}
      </AvailabilityCard>
    </div>
  );
}
