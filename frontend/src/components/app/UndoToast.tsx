import { useCallback, useEffect, useState } from 'react';

/** Finestra per annullare; si ferma finché puntatore o focus sono sul toast (WCAG 2.2.1). */
const UNDO_WINDOW_MS = 8000;

export interface UndoNotice {
  message: string;
  undo: () => Promise<void>;
  /** Testo del pulsante; default "Annulla". */
  actionLabel?: string;
}

/** Stato del toast: `show` lo rimpiazza (un solo annullamento alla volta). */
export function useUndoToast() {
  const [notice, setNotice] = useState<UndoNotice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);
  return { notice, show: setNotice, dismiss };
}

interface UndoToastProps {
  notice: UndoNotice | null;
  onDismiss: () => void;
}

export function UndoToast({ notice, onDismiss }: UndoToastProps) {
  const [undoing, setUndoing] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!notice || paused || undoing) return undefined;
    const timer = setTimeout(onDismiss, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [notice, paused, undoing, onDismiss]);

  if (!notice) return null;

  const handleUndo = async () => {
    setUndoing(true);
    try {
      await notice.undo();
    } finally {
      setUndoing(false);
      setPaused(false);
      onDismiss();
    }
  };

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
    >
      <span>{notice.message}</span>
      <button
        type="button"
        onClick={() => void handleUndo()}
        disabled={undoing}
        className="min-h-8 cursor-pointer rounded-full px-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background disabled:opacity-60"
      >
        {undoing && !notice.actionLabel ? 'Ripristino…' : (notice.actionLabel ?? 'Annulla')}
      </button>
    </div>
  );
}
