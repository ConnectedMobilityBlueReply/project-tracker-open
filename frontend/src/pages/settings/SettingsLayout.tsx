import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PageHeader } from '@/components/app/PageHeader';
import { cn } from '@/lib/utils';
import { SETTINGS_UPDATES_PATH } from './useDesktopUpdates';

const SECTIONS = [{ to: SETTINGS_UPDATES_PATH, label: 'Aggiornamenti' }];

export function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Impostazioni" />
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Sezioni impostazioni">
          <ul className="flex gap-1 md:flex-col">
            {SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  className={({ isActive }) => cn(
                    'flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
