import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorBanner } from '@/components/app/StateMessages';

interface NewProjectDialogProps {
  open: boolean;
  /** Nome del padre T&M se si crea un sotto progetto, null per un progetto autonomo. */
  parentName: string | null;
  onOpenChange: (open: boolean) => void;
  /** Crea il progetto; se rifiuta, il messaggio dell'errore viene mostrato nel dialog. */
  onCreate: (name: string) => Promise<void>;
}

export function NewProjectDialog({ open, parentName, onOpenChange, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setName(''); setError(null); }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Errore nella creazione del progetto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-card sm:max-w-[480px]">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle>{parentName ? 'Nuovo sotto progetto' : 'Nuovo progetto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field required>
            <FieldLabel>Nome</FieldLabel>
            <Input
              type="text"
              required
              autoFocus
              placeholder="Es. CRM Upgrade 2026"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </Field>
          <DialogDescription className="text-xs">
            {parentName
              ? `Sotto progetto di ${parentName}: eredita area, società, PM e codice offerta. Il consuntivo confluisce nel plafond e nella fatturazione del padre.`
              : 'Descrizione, offerta e task si configurano dopo la creazione: le modifiche si salvano da sole.'}
          </DialogDescription>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Creazione…' : parentName ? 'Crea sotto progetto' : 'Crea progetto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
