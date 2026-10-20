import { PageHeader } from '@/components/app/PageHeader';
import Schedule from '../Schedule';

export default function TuttiPlanning() {
  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Planning" description="Capacità e assegnazioni di tutte le persone di tutti i team." />
      <Schedule embedded />
    </div>
  );
}
