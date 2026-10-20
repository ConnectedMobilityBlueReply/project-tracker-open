import { PageHeader } from '@/components/app/PageHeader';
import { CardState } from '@/components/dashboard/CardState';
import { OverallTasksCard } from '@/components/dashboard/OverallTasksCard';
import { ProjectListCard } from '@/components/dashboard/ProjectListCard';
import { ProjectProgressCard } from '@/components/dashboard/ProjectProgressCard';
import { ProjectTrackCard } from '@/components/dashboard/ProjectTrackCard';
import { ProjectTimelineCard } from '@/components/dashboard/ProjectTimelineCard';
import { WatchlistStrip } from '@/components/dashboard/WatchlistStrip';
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { useState } from 'react';

export default function Dashboard() {
  const { wbs, monthly, projects, listed } = useDashboardData();
  const [today] = useState(() => new Date().toLocaleDateString('sv-SE'));

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Dashboard" description="Panoramica di attività, consuntivi e progetti." />
      <CardState title="Da guardare" sources={[projects]} skeletonClassName="h-20">
        {() => <WatchlistStrip projects={projects.data!} today={today} />}
      </CardState>
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-3">
          <CardState title="Attività WBS" sources={[wbs]}>
            {() => <OverallTasksCard wbs={wbs.data!} />}
          </CardState>
          <CardState title="Andamento progetti" sources={[monthly, projects]}>
            {() => <ProjectTrackCard monthly={monthly.data!} projects={projects.data!} today={today} />}
          </CardState>
          <CardState title="Avanzamento progetti" sources={[projects, listed, monthly]}>
            {() => <ProjectProgressCard projects={projects.data!} listed={listed.data!} monthly={monthly.data!} today={today} />}
          </CardState>
        </div>
        <CardState title="Timeline progetti" sources={[projects]} skeletonClassName="h-64">
          {() => <ProjectTimelineCard projects={projects.data!} today={today} />}
        </CardState>
        <CardState title="Elenco progetti" sources={[projects]} skeletonClassName="h-64">
          {() => <ProjectListCard projects={projects.data!} />}
        </CardState>
      </div>
    </div>
  );
}
