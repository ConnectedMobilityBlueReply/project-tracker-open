import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface TimelineToolbarProps {
  title: string;
  /** Numero accanto al titolo (righe visibili). */
  count?: number;
  /** Controlli subito dopo il titolo (es. switch di modalita'). */
  left?: ReactNode;
  /** Azioni a destra (ricerca, filtri, azione primaria). */
  right?: ReactNode;
}

/** Barra in alto comune a Consuntivazione e Timeline Team, stile Plane. */
export default function TimelineToolbar({ title, count, left, right }: TimelineToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {count != null && (
        <Badge variant="secondary" size="sm" className="tabular-nums">
          {count}
        </Badge>
      )}
      {left}
      {right != null && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/** Seconda barra (navigazione, Oggi, zoom): la stessa per shell e Settimanale. */
export function TimelineSubbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-topbar px-3 py-2">
      {children}
    </div>
  );
}
