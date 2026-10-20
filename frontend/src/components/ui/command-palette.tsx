import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { navigationForRole, navigationOptionsFor } from '@/components/layout/navigation';
import NavIcon from '@/components/layout/NavIcon';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';

export const OPEN_COMMAND_PALETTE_EVENT = 'project-tracker:open-command-palette';

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => user ? navigationForRole(user.appRole, navigationOptionsFor(user)) : [],
    [user],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  if (!user) return null;

  // Esc, focus sull'input, reset della query alla chiusura e chiusura dopo la selezione
  // sono gestiti da CommandDialog (Radix Dialog smonta il contenuto alla chiusura).
  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Destinazioni"
      title="Vai a"
      description="Cerca una destinazione dell'applicazione."
    >
      <CommandInput placeholder="Vai a…" aria-label="Cerca una destinazione" />
      <CommandList>
        <CommandEmpty>Nessuna destinazione trovata.</CommandEmpty>
        {items.map(item => (
          <CommandItem key={item.to} value={item.label} onSelect={() => navigate(item.to)}>
            <NavIcon name={item.icon} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <CommandShortcut>{item.to}</CommandShortcut>
          </CommandItem>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
