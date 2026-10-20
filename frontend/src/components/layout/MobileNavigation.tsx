import { DotsThree } from '@phosphor-icons/react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import NavIcon from './NavIcon';
import { isNavigationItemActive, navigationOptionsFor, navigationSectionsForRole } from './navigation';

export default function MobileNavigation({ onOpenMore }: { onOpenMore(): void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const items = navigationSectionsForRole(user?.appRole ?? 'member', user ? navigationOptionsFor(user) : {})
    .flatMap(section => section.items)
    .filter(item => item.mobile)
    .slice(0, 3);

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-30 grid h-16 border-t border-border bg-card/95 backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
    >
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={() => `flex min-h-11 flex-col items-center justify-center gap-1 text-xs ${isNavigationItemActive(item, pathname) ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
        >
          {isNavigationItemActive(item, pathname) ? (
            <span className="flex h-7 w-12 items-center justify-center rounded-full bg-muted">
              <NavIcon name={item.icon} className="h-5 w-5" />
            </span>
          ) : (
            <NavIcon name={item.icon} className="h-5 w-5" />
          )}
          <span>{item.shortLabel ?? item.label}</span>
        </NavLink>
      ))}
      <button type="button" className="flex min-h-11 flex-col items-center justify-center gap-1 text-xs text-muted-foreground" onClick={onOpenMore}>
        <DotsThree aria-hidden="true" className="size-5" />
        <span>Altro</span>
      </button>
    </nav>
  );
}
