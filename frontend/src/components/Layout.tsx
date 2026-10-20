import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { useAlerts } from './layout/AlertCenter';
import AppSidebar from './layout/AppSidebar';
import ContentHeader from './layout/ContentHeader';
import MobileHeader from './layout/MobileHeader';
import MobileNavigation from './layout/MobileNavigation';
import CommandPalette from './ui/command-palette';

export default function Layout() {
  const { sidebarCollapsed, setSidebarCollapsed } = useWorkspace();
  const { user } = useAuth();
  const alertState = useAlerts(!user?.allTeams);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;

    const dismissDrawer = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };

    document.addEventListener('keydown', dismissDrawer, true);
    return () => document.removeEventListener('keydown', dismissDrawer, true);
  }, [drawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 80rem)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const sidebarState = {
    sidebarCollapsed,
    onSidebarCollapsedChange: setSidebarCollapsed,
  };

  return (
    <div className="min-h-app bg-canvas xl:grid xl:h-app xl:grid-cols-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-card px-4 py-2 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Salta al contenuto
      </a>
      <AppSidebar className="hidden xl:flex" alertState={alertState} {...sidebarState} />
      <div className="flex min-w-0 flex-col xl:my-3 xl:mr-3 xl:overflow-hidden xl:rounded-[20px] xl:border xl:border-border xl:bg-panel xl:shadow-xs">
        <MobileHeader className="xl:hidden" alertState={alertState} onOpenMenu={() => setDrawerOpen(true)} />
        <ContentHeader className="hidden md:block" />
        <main id="main-content" tabIndex={-1} className="relative min-h-0 flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
        <MobileNavigation onOpenMore={() => setDrawerOpen(true)} />
      </div>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          showClose={false}
          mobile="center"
          aria-describedby={undefined}
          className="fixed left-0 top-(--titlebar-height) h-app max-h-none w-72 max-w-[85vw] translate-x-0 translate-y-0 scale-100 gap-0 rounded-none bg-canvas p-0 text-sidebar-foreground sm:max-w-[85vw] xl:hidden animate-none!"
        >
          <DialogTitle className="sr-only">Navigazione principale</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              iconOnly
              aria-label="Chiudi navigazione"
              className="absolute right-2 top-2 z-10 min-h-11 min-w-11 text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </Button>
          </DialogClose>
          <AppSidebar isDrawer alertState={alertState} {...sidebarState} onNavigate={() => setDrawerOpen(false)} />
        </DialogContent>
      </Dialog>
      <CommandPalette />
    </div>
  );
}
