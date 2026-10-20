import { List } from '@phosphor-icons/react';
import { BrandMark } from '@/components/app/BrandMark';
import { ModeToggle } from '@/components/theme/ModeToggle';
import { Button } from '@/components/ui/button';
import type { AlertState } from './AlertCenter';
import AlertCenter from './AlertCenter';

interface MobileHeaderProps {
  className?: string;
  alertState: AlertState;
  onOpenMenu(): void;
}

export default function MobileHeader({
  className = '',
  alertState,
  onOpenMenu,
}: MobileHeaderProps) {
  return (
    <header className={`sticky top-0 z-20 border-b border-border bg-canvas text-foreground ${className}`}>
      <div className="flex min-h-14 items-center gap-2 px-3">
        <Button iconOnly variant="ghost" aria-label="Apri navigazione" className="min-h-11 min-w-11 text-sidebar-foreground hover:bg-accent hover:text-accent-foreground" onClick={onOpenMenu}>
          <List />
        </Button>
        <BrandMark className="flex-1" />
        <div className="shrink-0 [&_button]:min-h-11 [&_button]:min-w-11">
          <ModeToggle />
        </div>
        <AlertCenter state={alertState} />
      </div>
    </header>
  );
}
