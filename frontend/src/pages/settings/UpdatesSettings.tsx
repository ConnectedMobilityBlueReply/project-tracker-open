import { Navigate } from 'react-router-dom';
import { ArrowsClockwise, CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Progress, ProgressValue } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { SectionCard } from '@/components/app/SectionCard';
import { cn } from '@/lib/utils';
import { formatCheckedAt, updateStatusView } from '@/lib/updateStatusView';
import { SettingsLayout } from './SettingsLayout';
import { useDesktopUpdates } from './useDesktopUpdates';

const TONE_CLASS = {
  neutral: 'text-muted-foreground',
  success: 'text-success-strong',
  danger: 'text-destructive',
} as const;

const TONE_ICON = { neutral: Info, success: CheckCircle, danger: WarningCircle } as const;

export default function UpdatesSettings() {
  const updates = useDesktopUpdates();
  if (!updates) return <Navigate to="/" replace />;

  const { state } = updates;
  const view = state ? updateStatusView(state) : null;
  const Icon = view ? TONE_ICON[view.tone] : Info;
  // Niente `disabled` nativo: toglierebbe il focus al pulsante. Durante busy il click è annullato in onClick.
  const runAction = view?.action === 'install' ? updates.install : updates.check;

  return (
    <SettingsLayout>
      <SectionCard
        title="Aggiornamenti app"
        icon={<ArrowsClockwise />}
        footer={view?.action ? (
          <div className="flex justify-end">
            <Button
              variant={view.action === 'install' ? 'primary' : 'secondary'}
              aria-disabled={view.busy || undefined}
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
              onClick={view.busy ? undefined : runAction}
            >
              {view.actionLabel}
            </Button>
          </div>
        ) : undefined}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-foreground">Versione installata: {state?.currentVersion ?? '—'}</p>
            <p className="text-xs text-muted-foreground">
              Ultimo controllo: {state ? formatCheckedAt(state.checkedAt, new Date()) : '—'}
            </p>
          </div>
          <p role="status" className={cn('flex items-center gap-2 text-sm', view && TONE_CLASS[view.tone])}>
            {view?.busy ? <Spinner aria-hidden /> : <Icon aria-hidden />}
            {view?.message ?? 'Lettura stato…'}
          </p>
          {view?.showProgress && (
            <Progress value={state?.percent ?? null} aria-label="Avanzamento download">
              <ProgressValue />
            </Progress>
          )}
        </div>
      </SectionCard>
    </SettingsLayout>
  );
}
