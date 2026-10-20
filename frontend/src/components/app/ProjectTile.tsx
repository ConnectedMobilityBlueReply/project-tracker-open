// Tile con iniziale e colore del progetto. Il Piano 3 aggiunge l'icona dashboardicons.
import { initials } from '@/lib/people';
import { projectIconUrl } from '@/lib/projectIcons';
import { projectColor } from '@/lib/scheduleModel';
import { cn } from '@/lib/utils';

export function ProjectTile({ id, name, icon, size = 'md' }: { id: number; name: string; icon?: string | null; size?: 'sm' | 'md' }) {
  const iconUrl = projectIconUrl(icon);
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={cn(
          'shrink-0 rounded-sm bg-card object-contain p-1 ring-1 ring-border',
          size === 'sm' ? 'size-6' : 'size-8',
        )}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm font-semibold text-white',
        size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm',
      )}
      style={{ backgroundColor: projectColor(id, null) }}
    >
      {initials(name).charAt(0)}
    </span>
  );
}
