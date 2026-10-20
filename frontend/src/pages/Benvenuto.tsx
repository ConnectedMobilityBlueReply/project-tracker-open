import { useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/app/BrandMark';
import { Button } from '@/components/ui/button';
import { CreateTeamForm } from '../components/team/CreateTeamForm';
import { InvitesList } from '../components/team/InvitesList';
import { useAuth } from '../auth/AuthContext';

/** Onboarding di chi è autenticato ma non fa parte di nessun team. Fuori dal Layout. */
export default function Benvenuto() {
  const navigate = useNavigate();
  const { account, invites, logout } = useAuth();

  return (
    <main className="flex min-h-app items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md space-y-6 rounded-card border border-border bg-card p-6 shadow-xs">
        <BrandMark wordmark />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Non fai ancora parte di nessun team</h1>
          <p className="text-sm text-muted-foreground">
            Crea il tuo team per iniziare: ne sarai l'amministratore e potrai aggiungere le persone.
          </p>
        </div>
        {invites.length > 0 && (
          <section className="space-y-3" aria-labelledby="inviti-ricevuti">
            <h2 id="inviti-ricevuti" className="text-sm font-semibold text-foreground">Inviti ricevuti</h2>
            <InvitesList />
          </section>
        )}
        <CreateTeamForm autoFocus onCreated={() => navigate('/', { replace: true })} />
        {invites.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Se aspetti un invito, chiedi all'amministratore del team di aggiungerti con la tua email
            {account ? ` (${account.email})` : ''}.
          </p>
        )}
        <Button type="button" variant="link" className="px-0" onClick={() => void logout()}>
          Esci
        </Button>
      </div>
    </main>
  );
}
