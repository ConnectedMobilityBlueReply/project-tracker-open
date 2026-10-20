import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { OptionValue } from '../../types';

export const NONE = '__none__';

interface CatalogSelectProps {
  label: string;
  value: string;
  options: OptionValue[];
  onChange: (value: string) => void;
  /** Mostrato quando il catalogo è vuoto, es. "Aggiungila da Opzioni → Area". */
  emptyHint: string;
  placeholder?: string;
  hasError?: boolean;
  error?: string;
  className?: string;
}

/**
 * Select su un catalogo di Opzioni. Un valore salvato che non è più nel catalogo resta
 * selezionabile, altrimenti la select lo mostrerebbe vuoto e il prossimo salvataggio lo perderebbe.
 */
export function CatalogSelect({
  label, value, options, onChange, emptyHint, placeholder = 'Nessuno', hasError, error, className,
}: CatalogSelectProps) {
  const isOrphan = value !== '' && !options.some(option => option.value === value);
  return (
    <Field className={className} hasError={hasError}>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value || NONE} onValueChange={next => onChange(next === NONE ? '' : next)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{placeholder}</SelectItem>
          {isOrphan && <SelectItem value={value}>{value}</SelectItem>}
          {options.map(option => (
            <SelectItem value={option.value} key={option.id}>{option.value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <FieldHint role="alert">{error}</FieldHint>
        : options.length === 0 && <FieldHint>{emptyHint}</FieldHint>}
    </Field>
  );
}
