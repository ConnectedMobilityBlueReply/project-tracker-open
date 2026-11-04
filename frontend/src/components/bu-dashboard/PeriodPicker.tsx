import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { validatePeriod } from '@/lib/buDashboardModel';

interface Period {
  from: string;
  to: string;
}

interface PeriodPickerProps {
  period: Period;
  onChange: (next: Period) => void;
}

/** Periodo di Investimento ed Efficienza: `onChange` riceve solo periodi validi, il resto mostra il messaggio. */
export function PeriodPicker({ period, onChange }: PeriodPickerProps) {
  const [draft, setDraft] = useState<Period>(period);
  const error = validatePeriod(draft.from, draft.to);

  const updateDraft = (field: keyof Period, value: string) => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (validatePeriod(next.from, next.to) == null) onChange(next);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="block space-y-1 sm:w-48">
        <span className="text-sm font-medium">Dal</span>
        <Input
          type="date"
          value={draft.from}
          hasError={error != null}
          onChange={event => updateDraft('from', event.target.value)}
        />
      </label>
      <label className="block space-y-1 sm:w-48">
        <span className="text-sm font-medium">Al</span>
        <Input
          type="date"
          value={draft.to}
          hasError={error != null}
          onChange={event => updateDraft('to', event.target.value)}
        />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
