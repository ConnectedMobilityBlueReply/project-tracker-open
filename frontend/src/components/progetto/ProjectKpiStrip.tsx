import { Progress } from '@/components/ui/progress';
import { consumptionTone } from '@/lib/statusTone';
import type { PartnerAllocation } from '../../types';

interface ProjectKpiStripProps {
  completionPct: number;
  totalEstimated: number;
  totalActual: number;
  totalStima: number;
  startDate: string | null;
  endDate: string | null;
  estimateDays: number | undefined;
  totalPartnerDays: number;
  totalStimaOwn: number;
  partnerAllocations: readonly PartnerAllocation[];
}

function Kpi({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-surface-soft p-4">
      <dt className="text-sm text-body">{label}</dt>
      <dd className="mt-1">
        {children}
        {hint && <p className="mt-1 text-[11px] text-body">{hint}</p>}
      </dd>
    </div>
  );
}

const VALUE = 'text-2xl font-semibold tabular-nums';

/** Quattro valori primari in una card; stima giorni, partner e stima propria in una riga secondaria. */
export function ProjectKpiStrip({
  completionPct, totalEstimated, totalActual, totalStima, startDate, endDate,
  estimateDays, totalPartnerDays, totalStimaOwn, partnerAllocations,
}: ProjectKpiStripProps) {
  const overBudget = totalEstimated > 0 && totalActual > totalEstimated;
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface-soft" aria-label="Indicatori del progetto">
      <dl className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        <Kpi label="Avanzamento">
          <p className={`${VALUE} ${completionPct > 100 ? 'text-destructive' : 'text-primary'}`}>{completionPct}%</p>
          <Progress value={completionPct} size="sm" tone={consumptionTone(completionPct)} className="mt-2" aria-label={`Avanzamento ${completionPct}%`} />
        </Kpi>
        <Kpi label="Giorni lavorati / stimati">
          <p className={`${VALUE} ${overBudget ? 'text-destructive' : 'text-foreground'}`}>
            {totalActual.toFixed(1)} <span className="text-base font-normal text-body">/ {totalEstimated.toFixed(1)}gg</span>
          </p>
        </Kpi>
        <Kpi label="Totale stima" hint="Stima + estensioni + partner">
          <p className={`${VALUE} text-foreground`}>{totalStima.toFixed(1)}gg</p>
        </Kpi>
        <Kpi label="Periodo">
          <p className="text-base font-semibold tabular-nums text-foreground">
            {startDate ?? '—'} → {endDate ?? '—'}
          </p>
        </Kpi>
      </dl>
      <p className="border-t border-border px-4 py-2 text-xs text-body">
        Stima giorni {estimateDays ?? '-'} · Altri partner {totalPartnerDays.toFixed(1)}gg (escluse da grafici e statistiche) · Stima propria {totalStimaOwn.toFixed(1)}gg
        {partnerAllocations.length > 0 && (
          <> · Dettaglio partner: {partnerAllocations.map(partner => `${partner.societa} ${partner.giornate}gg`).join(', ')}</>
        )}
      </p>
    </section>
  );
}
