import { useEffect, useRef, useState } from 'react';
import { Copy, DotsThree, Plus, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProjectTile } from '@/components/app/ProjectTile';
import { StatusBadge } from '@/components/app/StatusBadge';
import { projectStatusTone } from '@/lib/statusTone';
import { cn } from '@/lib/utils';
import type { SaveState } from '@/lib/autosaveQueue';
import type { ProjectChild } from '../../types';

export interface SectionLink {
  id: string;
  label: string;
  count?: number;
}

interface ProjectDetailHeaderProps {
  projectId: number;
  name: string;
  icon: string;
  status: string;
  subtitle: string;
  saveState: SaveState;
  hasInvalid: boolean;
  sections: SectionLink[];
  onRetry: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Solo per i progetti T&M: sotto progetti collegati (chip) e creazione rapida. Assente = sezione nascosta. */
  subprojects?: ProjectChild[];
  onOpenProject?: (id: number) => void;
  onNewSubproject?: () => void;
}

const timeFormatter = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

function SaveIndicator({ state, hasInvalid, onRetry }: { state: SaveState; hasInvalid: boolean; onRetry: () => void }) {
  const tone = state.status === 'error' || hasInvalid ? 'error' : state.status;
  const dot = {
    error: 'bg-destructive',
    saving: 'bg-brand motion-safe:animate-pulse',
    saved: 'bg-success',
    idle: 'bg-success',
  }[tone];
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center gap-2 whitespace-nowrap text-sm', tone === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', dot)} />
      {state.status === 'error' ? (
        <>
          Errore di salvataggio
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>Riprova</Button>
        </>
      ) : hasInvalid ? 'Non salvato: correggi i campi evidenziati'
        : state.status === 'saving' ? 'Salvataggio…'
        : state.status === 'saved' && state.savedAt ? `Salvato alle ${timeFormatter.format(state.savedAt)}`
        : 'Modifiche salvate automaticamente'}
    </div>
  );
}

/** Margine sotto la testata fissa entro cui una sezione conta come "raggiunta". */
const ACTIVE_SLACK_PX = 32;
/** Dopo un clic su un'ancora la sezione scelta resta attiva per la durata dello scroll. */
const CLICK_LOCK_MS = 1000;

/**
 * Sezione attiva = l'ultima il cui bordo superiore ha raggiunto la testata fissa; a fondo
 * pagina l'ultima sezione, che altrimenti non arriverebbe mai in cima.
 */
function useActiveSection(ids: string[], headerRef: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(ids[0]);
  const lockedUntil = useRef(0);
  const key = ids.join('|');
  useEffect(() => {
    const order = key.split('|');
    const update = (event?: Event) => {
      if (Date.now() < lockedUntil.current) return;
      const scroller = event?.target instanceof HTMLElement ? event.target : document.scrollingElement;
      if (scroller && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 4 && scroller.scrollTop > 0) {
        setActive(order[order.length - 1]);
        return;
      }
      const threshold = (headerRef.current?.getBoundingClientRect().bottom ?? 0) + ACTIVE_SLACK_PX;
      let current = order[0];
      for (const id of order) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= threshold) current = id;
      }
      setActive(current);
    };
    update();
    // capture: intercetta lo scroll di qualsiasi contenitore (qui il <main> del layout), non solo della finestra.
    document.addEventListener('scroll', update, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', update, { capture: true });
  }, [key, headerRef]);
  const select = (id: string) => {
    lockedUntil.current = Date.now() + CLICK_LOCK_MS;
    setActive(id);
  };
  return [active, select] as const;
}

export function ProjectDetailHeader({
  projectId, name, icon, status, subtitle, saveState, hasInvalid, sections, onRetry, onDuplicate, onDelete,
  subprojects, onOpenProject, onNewSubproject,
}: ProjectDetailHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const [active, selectSection] = useActiveSection(sections.map(section => section.id), headerRef);

  return (
    <div ref={headerRef} className="sticky top-0 z-20 border-b border-border bg-panel/90 backdrop-blur">
      <div className="flex items-center gap-4 px-4 pt-4 pb-3 sm:px-6 lg:px-8">
        <ProjectTile id={projectId} name={name || '?'} icon={icon || null} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground">{name || 'Senza nome'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge tone={projectStatusTone(status)} size="sm">{status}</StatusBadge>
            <span>{subtitle}</span>
          </div>
          {onNewSubproject && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Sotto progetti">
              {subprojects?.map(child => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onOpenProject?.(child.id)}
                  className="min-h-7 cursor-pointer rounded-full border border-border bg-card px-2.5 text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {child.name}
                </button>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={onNewSubproject}>
                <Plus aria-hidden="true" className="size-4" />
                Nuovo sotto progetto
              </Button>
            </div>
          )}
        </div>
        <SaveIndicator state={saveState} hasInvalid={hasInvalid} onRetry={onRetry} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" iconOnly aria-label="Altre azioni sul progetto">
              <DotsThree aria-hidden="true" className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}><Copy /> Duplica progetto</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash /> Elimina progetto…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav aria-label="Sezioni del progetto" className="flex gap-1 overflow-x-auto px-3 pb-2.5 sm:px-5 lg:px-7">
        {sections.map(section => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? 'location' : undefined}
            onClick={() => selectSection(section.id)}
            className={cn(
              'inline-flex min-h-8 items-center whitespace-nowrap rounded-full px-3 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              active === section.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {section.label}
            {section.count ? <span className="ml-1.5 opacity-70">{section.count}</span> : null}
          </a>
        ))}
      </nav>
    </div>
  );
}
