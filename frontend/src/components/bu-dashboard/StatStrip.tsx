import { Button } from '@/components/ui/button';
import { Stat, StatCaption, StatLabel, StatValue } from '@/components/ui/stat';
import { dashboardCounts, freeEntries, overallocatedEntries, uncoveredEntries } from '@/lib/buDashboardModel';
import { formatDays } from '@/lib/buModel';
import type { BuInvestmentRow, BuPerson } from '@/types';
import type { BuSource } from './useBuDashboardData';

const PLACEHOLDER = '—';

interface StatStripProps {
  people: BuSource<BuPerson[]>;
  investment: BuSource<BuInvestmentRow[]>;
}

interface TileProps {
  label: string;
  source: BuSource<unknown>;
  /** Null finché la fonte non ha dati: mostra il caricamento al posto del numero. */
  value: string | null;
  caption: string;
}

function StatTile({ label, source, value, caption }: TileProps) {
  return (
    <Stat>
      <StatLabel>{label}</StatLabel>
      <StatValue>{value ?? PLACEHOLDER}</StatValue>
      <StatCaption>
        {source.error != null ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{source.error}</span>
            <Button type="button" variant="outline" size="sm" onClick={source.reload}>Riprova</Button>
          </span>
        ) : value == null ? 'Caricamento…' : caption}
      </StatCaption>
    </Stat>
  );
}

/** Quattro numeri della dashboard: la disponibilità e l'investimento hanno ciascuno il proprio stato. */
export function StatStrip({ people, investment }: StatStripProps) {
  const personList = people.data ?? [];
  const counts = dashboardCounts(
    freeEntries(personList),
    overallocatedEntries(personList),
    uncoveredEntries(personList),
    investment.data ?? [],
  );
  const peopleReady = people.data != null;
  const investmentReady = investment.data != null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Liberi"
        source={people}
        value={peopleReady ? String(counts.free) : null}
        caption="Persone con giorni liberi"
      />
      <StatTile
        label="Sovrallocati"
        source={people}
        value={peopleReady ? String(counts.over) : null}
        caption="Persone oltre la capacità"
      />
      <StatTile
        label="Senza lavoro dopo"
        source={people}
        value={peopleReady ? String(counts.uncovered) : null}
        caption="Lavorano ora, non fino all'ultima settimana"
      />
      <StatTile
        label="Giorni di investimento da fare"
        source={investment}
        value={investmentReady ? `${formatDays(counts.investmentTodoDays)} gg` : null}
        caption="Sull'intera vita dei progetti"
      />
    </div>
  );
}
