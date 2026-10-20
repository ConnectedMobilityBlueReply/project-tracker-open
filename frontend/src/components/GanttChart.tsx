import { ProjectTask, TASK_COLORS, TASK_LABELS, TaskType, TaskDependency } from '../types';
import { useState } from 'react';

interface GanttChartProps {
  tasks: ProjectTask[];
  dependencies?: TaskDependency[];
}

interface TooltipState {
  x: number;
  y: number;
  task: ProjectTask;
}

export default function GanttChart({ tasks, dependencies = [] }: GanttChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const tasksWithDates = tasks.filter(t => t.planned_start && t.planned_end);

  if (tasksWithDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-md border border-dashed border-border bg-background">
        <p className="text-muted-foreground text-sm">Nessun task con date pianificate</p>
      </div>
    );
  }

  const allDates = tasksWithDates.flatMap(t => [
    new Date(t.planned_start!),
    new Date(t.planned_end!)
  ]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

  // Add padding
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 3);

  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

  const CHART_WIDTH = 700;
  const ROW_HEIGHT = 44;
  const LABEL_WIDTH = 130;
  const BAR_HEIGHT = 24;
  const BAR_MARGIN = (ROW_HEIGHT - BAR_HEIGHT) / 2;
  const CHART_AREA = CHART_WIDTH - LABEL_WIDTH;

  const dateToX = (date: Date) => {
    const days = (date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
    return LABEL_WIDTH + (days / totalDays) * CHART_AREA;
  };

  // Generate month markers
  const months: { label: string; x: number }[] = [];
  const cursor = new Date(minDate);
  cursor.setDate(1);
  while (cursor <= maxDate) {
    const x = dateToX(cursor);
    if (x >= LABEL_WIDTH) {
      months.push({
        label: cursor.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
        x
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const chartHeight = tasksWithDates.length * ROW_HEIGHT + 40;

  // Build task index map for arrow rendering
  const taskRowIndex = new Map<number, number>();
  tasksWithDates.forEach((t, i) => taskRowIndex.set(t.id, i));

  // Compute bar end/start X for each task
  const barEndX = (task: ProjectTask) => {
    const end = new Date(task.planned_end!);
    return dateToX(end);
  };
  const barStartX = (task: ProjectTask) => {
    const start = new Date(task.planned_start!);
    return dateToX(start);
  };
  const rowCenterY = (rowIdx: number) => 30 + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <div className="relative overflow-x-auto">
      <div className="flex gap-3 mb-3 flex-wrap">
        {(Object.keys(TASK_COLORS) as TaskType[]).map(type => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TASK_COLORS[type] }} />
            {TASK_LABELS[type]}
          </div>
        ))}
      </div>

      <svg width={CHART_WIDTH} height={chartHeight} className="font-sans">
        {/* Arrowhead marker */}
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="var(--muted-foreground)" />
          </marker>
        </defs>

        {/* Background grid */}
        {months.map((m, i) => (
          <line
            key={i}
            x1={m.x} y1={30}
            x2={m.x} y2={chartHeight}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}

        {/* Month labels */}
        {months.map((m, i) => (
          <text key={i} x={m.x + 4} y={20} fontSize={10} fill="var(--muted-foreground)">{m.label}</text>
        ))}

        {/* Task rows */}
        {tasksWithDates.map((task, i) => {
          const y = 30 + i * ROW_HEIGHT;
          const start = new Date(task.planned_start!);
          const end = new Date(task.planned_end!);
          const x1 = dateToX(start);
          const x2 = dateToX(end);
          const barWidth = Math.max(4, x2 - x1);
          const color = TASK_COLORS[task.task_type];

          return (
            <g key={task.id}>
              {/* Alternating row background */}
              {i % 2 === 0 && (
                <rect x={0} y={y} width={CHART_WIDTH} height={ROW_HEIGHT} fill="var(--muted)" />
              )}

              {/* Task label */}
              <text x={8} y={y + ROW_HEIGHT / 2 + 4} fontSize={11} fill="var(--foreground)" fontWeight="500">
                {TASK_LABELS[task.task_type]}
              </text>

              {/* Gantt bar */}
              <rect
                x={x1}
                y={y + BAR_MARGIN}
                width={barWidth}
                height={BAR_HEIGHT}
                fill={color}
                rx={4}
                opacity={0.85}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  const svgEl = (e.target as SVGElement).closest('svg');
                  const rect = svgEl?.getBoundingClientRect();
                  setTooltip({
                    x: e.clientX - (rect?.left ?? 0),
                    y: e.clientY - (rect?.top ?? 0),
                    task
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />

              {/* Bar label if wide enough */}
              {barWidth > 50 && (
                <text
                  x={x1 + barWidth / 2}
                  y={y + BAR_MARGIN + BAR_HEIGHT / 2 + 4}
                  fontSize={10}
                  fill="var(--background)"
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  {task.estimated_days ? `${task.estimated_days}gg` : ''}
                </text>
              )}
            </g>
          );
        })}

        {/* Dependency arrows */}
        {dependencies.map(dep => {
          const predIdx = taskRowIndex.get(dep.predecessor_task_id);
          const succIdx = taskRowIndex.get(dep.successor_task_id);
          const predTask = tasksWithDates.find(t => t.id === dep.predecessor_task_id);
          const succTask = tasksWithDates.find(t => t.id === dep.successor_task_id);
          if (predIdx == null || succIdx == null || !predTask || !succTask) return null;

          const x1 = barEndX(predTask);
          const y1 = rowCenterY(predIdx);
          const x2 = barStartX(succTask);
          const y2 = rowCenterY(succIdx);
          const midX = (x1 + x2) / 2;

          // Elbow path: right from pred end, then vertical, then to succ start
          const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2 - 2} ${y2}`;

          return (
            <path
              key={dep.id}
              d={d}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4,2"
              markerEnd="url(#arrowhead)"
              opacity={0.7}
            />
          );
        })}

        {/* Today marker */}
        {(() => {
          const todayX = dateToX(new Date());
          if (todayX >= LABEL_WIDTH && todayX <= CHART_WIDTH) {
            return (
              <g>
                <line x1={todayX} y1={30} x2={todayX} y2={chartHeight} stroke="var(--destructive)" strokeWidth={1.5} strokeDasharray="4,2" />
                <text x={todayX + 3} y={40} fontSize={9} fill="var(--destructive)">Oggi</text>
              </g>
            );
          }
          return null;
        })()}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-card p-3 text-xs shadow-lg"
          style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
        >
          <p className="mb-1 font-semibold text-foreground">{TASK_LABELS[tooltip.task.task_type]}</p>
          <p className="text-muted-foreground">Inizio: {tooltip.task.planned_start}</p>
          <p className="text-muted-foreground">Fine: {tooltip.task.planned_end}</p>
          {tooltip.task.estimated_days && (
            <p className="text-muted-foreground">Giorni stimati: {tooltip.task.estimated_days}</p>
          )}
          {tooltip.task.actual_days !== undefined && (
            <p className="text-muted-foreground">Giorni lavorati: {tooltip.task.actual_days}gg</p>
          )}
          {(tooltip.task.dependencies?.length ?? 0) > 0 && (
            <p className="text-muted-foreground mt-1">
              Dipende da: {tooltip.task.dependencies!.map(d => {
                const pred = tasks.find(t => t.id === d.predecessor_task_id);
                return pred ? TASK_LABELS[pred.task_type] : `#${d.predecessor_task_id}`;
              }).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
