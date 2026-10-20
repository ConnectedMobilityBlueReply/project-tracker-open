import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CaretDoubleLeft, CaretDoubleRight, Gear, MagnifyingGlass, Moon, SignOut, Sun, Monitor } from '@phosphor-icons/react';
import { useTheme } from 'next-themes';
import { AvatarFallback, AvatarRoot } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import {
  Sidebar,
  SidebarActions,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarItem,
  SidebarSwitcher,
} from '@/components/ui/sidebar';
import { openCommandPalette } from '@/components/ui/command-palette';
import { BrandMark } from '@/components/app/BrandMark';
import { ProjectTile } from '@/components/app/ProjectTile';
import { SignalBars } from '@/components/app/SignalBars';
import { getProjects } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { avatarColorFor, initials } from '@/lib/people';
import { sidebarProjects, type SidebarProject } from '@/lib/projectProgress';
import { cn } from '@/lib/utils';
import { SETTINGS_UPDATES_PATH, useDesktopUpdates } from '@/pages/settings/useDesktopUpdates';
import type { AlertState } from './AlertCenter';
import AlertCenter from './AlertCenter';
import NavIcon from './NavIcon';
import TeamSwitcher from './TeamSwitcher';
import { isNavigationItemActive, navigationOptionsFor, navigationSectionsForRole } from './navigation';

/** Voce della sidebar navy: hover sul token sidebar, voce attiva piena sull'accento con testo bianco. */
const NAV_ROW = 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-none data-[active=true]:ring-0';

interface AppSidebarProps {
  className?: string;
  isDrawer?: boolean;
  alertState: AlertState;
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange(collapsed: boolean): void;
  onNavigate?(): void;
}

function useSidebarProjects(enabled: boolean, pathname: string): SidebarProject[] {
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const latestRequest = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    // Errore o 403: il gruppo resta nascosto. La sidebar non mostra errori.
    const reload = () => {
      const request = ++latestRequest.current;
      getProjects().then(list => {
        if (alive && request === latestRequest.current) setProjects(sidebarProjects(list));
      }, () => {});
    };
    reload();
    window.addEventListener('focus', reload);
    return () => {
      alive = false;
      window.removeEventListener('focus', reload);
    };
  }, [enabled, pathname]);
  return enabled ? projects : [];
}

export default function AppSidebar({
  className,
  isDrawer = false,
  alertState,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  onNavigate,
}: AppSidebarProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { setTheme } = useTheme();
  const collapsed = sidebarCollapsed && !isDrawer;
  // In Tutti i Team i progetti sono nella pagina dedicata: il gruppo sarebbe quello di un solo team.
  const canSeeProjects = (user?.appRole === 'pm' || user?.appRole === 'admin') && !user.allTeams;
  const projects = useSidebarProjects(canSeeProjects, pathname);
  const updates = useDesktopUpdates();
  const updateReady = updates?.state?.status === 'ready';

  return (
    <Sidebar
      docked
      collapsed={collapsed}
      density="comfortable"
      aria-label="Navigazione principale"
      className={cn('h-app shrink-0 bg-sidebar', isDrawer ? 'w-full' : collapsed ? 'w-[72px]' : 'w-72', className)}
    >
      <SidebarHeader className={isDrawer ? 'pr-14' : undefined}>
        <BrandMark wordmark={!collapsed} />
        <SidebarActions>
          <AlertCenter state={alertState} />
        </SidebarActions>
      </SidebarHeader>

      <SidebarContent>
        <TeamSwitcher collapsed={collapsed} />

        {collapsed ? (
          <Button variant="ghost" iconOnly aria-label="Cerca (⌘K)" className="mx-auto" onClick={openCommandPalette}>
            <MagnifyingGlass />
          </Button>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex h-10 w-full items-center gap-2 rounded-lg bg-sidebar-accent px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <MagnifyingGlass aria-hidden="true" className="size-4" />
            <span>Cerca</span>
            <Kbd className="ml-auto">⌘K</Kbd>
          </button>
        )}

        {user && navigationSectionsForRole(user.appRole, navigationOptionsFor(user)).map(section => (
          <SidebarGroup key={section.key} aria-label={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            {section.items.map(item => {
              const count = item.badge ? alertState.alerts?.[item.badge] ?? 0 : 0;
              return (
                <SidebarItem key={item.to} asChild active={isNavigationItemActive(item, pathname)} label={item.label} className={NAV_ROW}>
                  <Link to={item.to} onClick={onNavigate}>
                    <NavIcon name={item.icon} />
                    {item.label}
                    {count > 0 && (
                      <Badge variant="destructive" size="sm" className="ml-auto bg-status-red text-status-ink tabular-nums">
                        {count > 9 ? '9+' : count}
                      </Badge>
                    )}
                  </Link>
                </SidebarItem>
              );
            })}
          </SidebarGroup>
        ))}

        {projects.length > 0 && (
          <SidebarGroup aria-label="Progetti in corso" hideWhenCollapsed>
            <SidebarGroupLabel>Progetti in corso</SidebarGroupLabel>
            {projects.map(project => {
              const to = `/progetti/${project.id}`;
              return (
                <SidebarItem key={project.id} asChild active={pathname === to || pathname.startsWith(`${to}/`)} label={project.name} className={NAV_ROW}>
                  <Link to={to} onClick={onNavigate}>
                    <ProjectTile id={project.id} name={project.name} icon={project.icon} />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    <SignalBars pct={project.pct} />
                  </Link>
                </SidebarItem>
              );
            })}
            <SidebarItem asChild label="Tutti i progetti">
              <Link to="/progetti" onClick={onNavigate} className="text-muted-foreground">
                Tutti i progetti
              </Link>
            </SidebarItem>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarSwitcher
                variant="full"
                aria-label={updateReady ? `${user.name}, aggiornamento pronto` : user.name}
                leading={(
                  <span className="relative inline-flex">
                    <AvatarRoot size="md" color={avatarColorFor(user.name)}>
                      <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </AvatarRoot>
                    {updateReady && (
                      <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-brand ring-2 ring-sidebar" />
                    )}
                  </span>
                )}
                title={user.name}
                subtitle={user.email}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuLabel>Tema</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme('light')}><Sun /> Chiaro</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}><Moon /> Scuro</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}><Monitor /> Sistema</DropdownMenuItem>
              {updates && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={SETTINGS_UPDATES_PATH} onClick={onNavigate}>
                      <Gear /> Impostazioni
                      {updateReady && <span className="ml-auto text-xs text-brand-strong">Aggiornamento pronto</span>}
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void logout()}><SignOut /> Esci</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isDrawer && (
          <Button
            variant="ghost"
            iconOnly
            aria-label={collapsed ? 'Espandi navigazione' : 'Comprimi navigazione'}
            className="min-h-11 min-w-11"
            onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
          >
            {collapsed ? <CaretDoubleRight /> : <CaretDoubleLeft />}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
