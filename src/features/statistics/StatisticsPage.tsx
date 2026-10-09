import { useMemo, useState } from 'react';
import { buildAnalyticsReport, type AnalyticsPeriod } from '../../domain/services/analyticsService';
import { useAppStore, getCurrentDate } from '../../application/appStore';

function minutes(value: number): string {
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function signed(value: number): string { return `${value > 0 ? '+' : ''}${value}%`; }
function barWidth(value: number, max: number): string { return `${max ? Math.max(2, Math.round((value / max) * 100)) : 0}%`; }

function bucketWorkload(points: ReturnType<typeof buildAnalyticsReport>['workload'], period: AnalyticsPeriod) {
  if (period === 'week') return points;
  const buckets = new Map<string, typeof points[number]>();
  for (const point of points) {
    const key = period === 'month' ? point.date.slice(0, 7) + '-W' + Math.ceil(Number(point.date.slice(8, 10)) / 7) : point.date.slice(0, 7);
    const current = buckets.get(key);
    if (!current) buckets.set(key, { ...point, date: key });
    else {
      current.plannedMinutes += point.plannedMinutes;
      current.actualMinutes += point.actualMinutes;
      current.completedMinutes += point.completedMinutes;
      current.completedTasks += point.completedTasks;
      current.reportedTasks += point.reportedTasks;
      current.loadPercent = current.plannedMinutes ? Math.round((current.actualMinutes / current.plannedMinutes) * 100) : 0;
    }
  }
  return [...buckets.values()];
}

export function StatisticsPage() {
  const state = useAppStore();
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const report = useMemo(() => buildAnalyticsReport({
    today: getCurrentDate(),
    period,
    roadmaps: state.roadmaps,
    roadmapTasks: state.roadmapTasks,
    concepts: state.curriculumConcepts,
    taskDefinitions: state.taskDefinitions,
    dailyTasks: state.dailyTasks,
    estimationProfiles: state.estimationProfiles,
    timePatternProfiles: state.timePatternProfiles,
    plannerOverrides: state.plannerOverrides,
    fallbackDailyCapacity: state.preferences?.maxStudyMinutesPerDay ?? 180,
  }), [period, state]);

  const workload = bucketWorkload(report.workload, period);
  const maxLoad = Math.max(...workload.map((point) => point.plannedMinutes), 1);
  const comparison = report.previousSummary ? report.summary.completionRate - report.previousSummary.completionRate : 0;
  const topSubject = report.subjects[0];
  const bestMilestone = [...report.milestones].sort((a, b) => b.progressPercent - a.progressPercent)[0];

  return <section className="page">
    <header className="page-header">
      <div>
        <p className="eyebrow">Evidence-based progress</p>
        <h1>Statistics</h1>
        <p className="muted">Your routine, measured across execution, workload, roadmaps, milestones, subjects, and the signals the planner is learning.</p>
      </div>
      <div className="period-tabs" role="tablist" aria-label="Analytics period">
        {(['week', 'month', 'year'] as AnalyticsPeriod[]).map((item) => <button key={item} className={period === item ? 'period-tab active' : 'period-tab'} onClick={() => setPeriod(item)}>{item === 'week' ? 'Weekly' : item === 'month' ? 'Monthly' : 'Yearly'}</button>)}
      </div>
    </header>

    <div className="notice-bar"><strong>{report.window.label}:</strong> {report.window.from} → {report.window.to}. Comparison uses the immediately preceding equivalent period.</div>

    <div className="stats-grid">
      <article className="card stat-card"><span>Completion rate</span><strong>{report.summary.completionRate}%</strong><small>{comparison === 0 ? 'same as previous period' : `${signed(comparison)} vs previous period`}</small></article>
      <article className="card stat-card"><span>Reported work</span><strong>{report.summary.reported}</strong><small>{report.summary.completed} complete · {report.summary.partial} partial · {report.summary.skipped} skipped</small></article>
      <article className="card stat-card"><span>Time executed</span><strong>{minutes(report.summary.actualMinutes)}</strong><small>{minutes(report.summary.plannedMinutes)} planned · {report.summary.actualVsPlannedPercent}% of plan</small></article>
      <article className="card stat-card"><span>Productive days</span><strong>{report.summary.productiveDays}</strong><small>{report.summary.activeDays} active days in the period</small></article>
    </div>

    <div className="content-grid">
      <article className="card large-card">
        <div className="card-heading"><div><span className="eyebrow">Workload trend</span><h2>Planned vs executed</h2></div><span className="pill">{period}</span></div>
        <div className="analytics-bars" aria-label="Workload trend chart">
          {workload.map((point) => <div className="analytics-bar" key={point.date} title={`${point.date}: ${point.plannedMinutes}m planned, ${point.actualMinutes}m actual`}>
            <div className="analytics-bar-track"><span style={{ height: barWidth(point.plannedMinutes, maxLoad) }} /></div>
            <div className="analytics-bar-value">{point.actualMinutes ? Math.round(point.actualMinutes) : 0}</div>
            <small>{period === 'year' ? point.date.slice(5) : point.date.slice(-5)}</small>
          </div>)}
        </div>
        <div className="chart-legend"><span><i className="legend-swatch planned" />planned</span><span><i className="legend-swatch actual" />actual is shown in the value labels</span></div>
      </article>

      <article className="card">
        <div className="card-heading"><div><span className="eyebrow">Period review</span><h2>What changed</h2></div></div>
        <div className="analysis-stack">
          <div className="setting-row"><div><strong>Roadmap time</strong><span>Share of planned work assigned to roadmaps</span></div><strong>{minutes(report.summary.roadmapMinutes)}</strong></div>
          <div className="setting-row"><div><strong>Habit time</strong><span>Recurring routine work</span></div><strong>{minutes(report.summary.habitMinutes)}</strong></div>
          <div className="setting-row"><div><strong>External time</strong><span>Urgent/admin work mixed into the same plan</span></div><strong>{minutes(report.summary.externalMinutes)}</strong></div>
          <div className="setting-row"><div><strong>Planning accuracy</strong><span>Actual minutes relative to planned minutes</span></div><strong>{report.summary.actualVsPlannedPercent}%</strong></div>
          <div className="setting-row"><div><strong>Unreported</strong><span>Work still without an explicit result</span></div><strong>{report.summary.unreported}</strong></div>
        </div>
      </article>
    </div>

    <div className="analytics-section">
      <div className="section-heading"><div><span className="eyebrow">Portfolio</span><h2>Roadmap progress</h2></div><span className="muted">Current state across active roadmaps</span></div>
      <div className="analytics-card-grid">
        {report.roadmaps.length === 0 ? <article className="card empty-state compact"><div><h3>No active roadmaps</h3><p>Add a roadmap to see progress here.</p></div></article> : report.roadmaps.map((roadmap) => <article className="card analytics-roadmap-card" key={roadmap.id}>
          <div className="card-heading"><div><strong>{roadmap.title}</strong><span className="muted">{roadmap.completedTasks}/{roadmap.totalTasks} tasks complete</span></div><span className="pill">{roadmap.paceStatus}</span></div>
          <div className="progress-track"><span style={{ width:`${roadmap.progressPercent}%` }} /></div>
          <div className="analytics-inline-meta"><span>{roadmap.progressPercent}% complete</span><span>{minutes(roadmap.estimatedRemainingMinutes)} remaining</span></div>
          <div className="analytics-inline-meta"><span>Projected: {roadmap.projectedCompletionDate ?? 'n/a'}</span><span>Target: {roadmap.targetDate ?? 'none'}</span></div>
        </article>)}
      </div>
    </div>

    <div className="content-grid">
      <article className="card">
        <div className="card-heading"><div><span className="eyebrow">Milestones</span><h2>Roadmap checkpoints</h2></div><span className="pill">{report.milestones.length}</span></div>
        {report.milestones.length === 0 ? <p className="muted">Milestone/project concepts will appear here when their curriculum has actionable tasks.</p> : <div className="analysis-stack">{report.milestones.slice(0, 10).map((item) => <div className="analytics-list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.roadmapTitle} · {item.completedTasks}/{item.totalTasks} tasks</span></div><div className="analytics-list-right"><span className="pill">{item.status}</span><strong>{item.progressPercent}%</strong></div></div>)}</div>}
        {bestMilestone && <div className="info-box analytics-callout"><strong>Closest checkpoint</strong><span>{bestMilestone.title} is at {bestMilestone.progressPercent}%.</span></div>}
      </article>

      <article className="card">
        <div className="card-heading"><div><span className="eyebrow">Subjects</span><h2>Performance</h2></div><span className="pill">{report.subjects.length}</span></div>
        {report.subjects.length === 0 ? <p className="muted">Report some roadmap work to populate subject performance.</p> : <div className="analysis-stack">{report.subjects.slice(0, 10).map((subject) => <div className="analytics-list-item" key={subject.key}><div><strong>{subject.label}</strong><span>{subject.completedTasks} complete · {subject.skippedTasks} skipped · {minutes(subject.actualMinutes)} actual</span></div><div className="analytics-list-right"><strong>{subject.completionRate}%</strong><span className="muted">{subject.estimateDeltaPercent > 0 ? '+' : ''}{subject.estimateDeltaPercent}% time delta</span></div></div>)}</div>}
        {topSubject && <div className="info-box analytics-callout"><strong>Highest workload subject</strong><span>{topSubject.label} accounts for {minutes(topSubject.plannedMinutes)} of planned roadmap time in this period.</span></div>}
      </article>
    </div>

    <div className="content-grid">
      <article className="card">
        <div className="card-heading"><div><span className="eyebrow">Adaptation</span><h2>What the planner has learned</h2></div><span className="pill">v0.8</span></div>
        <div className="analysis-metrics"><span><strong>{report.adaptation.estimationProfileCount}</strong>estimate scopes</span><span><strong>{report.adaptation.highConfidenceProfiles}</strong>high confidence</span><span><strong>{report.adaptation.timingProfileCount}</strong>timing profiles</span><span><strong>{report.adaptation.repeatedSkipTaskCount}</strong>repeat-skip tasks</span></div>
        <div className="analysis-stack analytics-detail-stack">
          <div className="setting-row"><div><strong>Average learned estimate shift</strong><span>Across scopes with learned estimates</span></div><strong>{signed(report.adaptation.learnedEstimateDeltaPercent)}</strong></div>
          <div className="setting-row"><div><strong>Planner overrides</strong><span>Manual choices the planner can learn from</span></div><strong>{Object.values(report.adaptation.overrideCounts).reduce((sum, value) => sum + value, 0)}</strong></div>
          <div className="setting-row"><div><strong>Repeated skips observed</strong><span>Signals for splitting, moving, or scope adjustment</span></div><strong>{report.adaptation.repeatedSkipCount}</strong></div>
        </div>
        {report.adaptation.strongestTimePatterns.length > 0 && <div className="adaptation-pattern-list">{report.adaptation.strongestTimePatterns.map((item) => <div className="analytics-list-item" key={`${item.scopeKey}:${item.daypart}`}><div><strong>{item.scopeKey}</strong><span>{item.daypart} is strongest in recent history</span></div><strong>{item.successRatePercent}% · {item.samples} samples</strong></div>)}</div>}
      </article>

      <article className="card">
        <div className="card-heading"><div><span className="eyebrow">Review discipline</span><h2>Consistency</h2></div><span className="pill">{report.summary.reported} reported</span></div>
        <div className="consistency-grid"><div><strong>{report.summary.completed}</strong><span>completed</span></div><div><strong>{report.summary.partial}</strong><span>partial</span></div><div><strong>{report.summary.skipped}</strong><span>skipped</span></div><div><strong>{report.summary.unreported}</strong><span>unreported</span></div></div>
        <div className="review-progress"><div className="review-progress-head"><span>Reported vs planned records</span><strong>{report.summary.reported + report.summary.unreported ? Math.round((report.summary.reported / (report.summary.reported + report.summary.unreported)) * 100) : 0}%</strong></div><div className="progress-track"><span style={{ width:`${report.summary.reported + report.summary.unreported ? (report.summary.reported / (report.summary.reported + report.summary.unreported))*100 : 0}%` }} /></div></div>
        <p className="muted analytics-footnote">The dashboard never treats missing reports as success. Unreported work stays visible until you explicitly resolve it.</p>
      </article>
    </div>
  </section>;
}
