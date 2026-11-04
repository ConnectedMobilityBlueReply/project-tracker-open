import { useState } from 'react';
import { PageHeader } from '@/components/app/PageHeader';
import { AvailabilityLists } from '@/components/bu-dashboard/AvailabilityLists';
import { EfficiencySection } from '@/components/bu-dashboard/EfficiencySection';
import { InvestmentSection } from '@/components/bu-dashboard/InvestmentSection';
import { PeriodPicker } from '@/components/bu-dashboard/PeriodPicker';
import { StatStrip } from '@/components/bu-dashboard/StatStrip';
import { AVAILABILITY_WEEKS, useBuDashboardData } from '@/components/bu-dashboard/useBuDashboardData';
import { yearPeriod } from '@/lib/buDashboardModel';

export default function TuttiDashboard() {
  const [period, setPeriod] = useState(() => yearPeriod(new Date()));
  const data = useBuDashboardData(period);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Dashboard planning"
        description={`Disponibilità di tutti i team nelle prossime ${AVAILABILITY_WEEKS} settimane; investimento ed efficienza nel periodo scelto.`}
      />
      <StatStrip people={data.people} investment={data.investment} />
      <AvailabilityLists people={data.people} />
      <PeriodPicker period={period} onChange={setPeriod} />
      <InvestmentSection investment={data.investment} period={period} />
      <EfficiencySection efficiency={data.efficiency} period={period} />
    </div>
  );
}
