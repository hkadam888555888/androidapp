import { useMemo } from 'react';
import { useAppStore } from '../../application/appStore';
import { validateDependencyGraph } from '../../domain/engine/dependencyEngine';
import { validateTasks } from '../../domain/services/curriculumValidator';
import { evaluateInvariants } from '../../domain/services/invariantService';
import { APP_VERSION, DB_VERSION } from '../../data/db/schema';
import { browserNotificationSupported } from '../../domain/services/notificationService';

export function DiagnosticsPage() {
  const state = useAppStore();
  const dependency = useMemo(() => validateDependencyGraph(state.roadmapTasks), [state.roadmapTasks]);
  const tasks = useMemo(() => validateTasks(state.taskDefinitions), [state.taskDefinitions]);
  const invariants = useMemo(() => evaluateInvariants(state.dailyTasks, state.roadmapTasks), [state.dailyTasks, state.roadmapTasks]);
  const checks = [
    ['Local storage', state.ready, state.error ?? 'IndexedDB state loaded'],
    ['Dependency graph', dependency.valid, dependency.valid ? 'No missing references or cycles' : `${dependency.cycles.length} cycle(s), ${dependency.missing.length} missing reference(s)`],
    ['Task contracts', tasks.valid, tasks.valid ? `${state.taskDefinitions.length} task definitions validated` : `${tasks.issues.length} validation issue(s)`],
    ['Explicit reporting', !state.dailyTasks.some((t) => t.status === 'completed' && !t.resultReportedAt), 'Completion records require an explicit report timestamp'],
    ['Curriculum versions', state.curriculumVersions.length > 0 || state.roadmaps.length === 0, `${state.curriculumVersions.length} stored curriculum version(s)`],
    ['Core invariants', invariants.ok, invariants.checks.filter((c) => !c.ok).map((c) => c.name).join(', ') || 'Core state invariants currently hold'],
    ['Browser notification path', state.preferences?.notificationsEnabled !== true || browserNotificationSupported(), state.preferences?.notificationsEnabled ? (browserNotificationSupported() ? 'Delivery is opt-in and depends on browser permission; app must remain open' : 'Delivery is enabled in settings but this browser lacks the Notification API') : 'Delivery is disabled until explicitly enabled'],
    ['AI privacy boundary', Boolean(state.aiSettings?.localOnly && !state.aiSettings?.cloudEnabled), state.aiSettings?.providerName === 'OpenAICompatibleLocalProvider' ? 'Loopback-only OpenAI-compatible adapter selected' : 'Deterministic offline provider selected'],
    ['App / schema version', true, `App ${APP_VERSION} · IndexedDB schema ${DB_VERSION}`],
  ];

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">Evidence & health</p><h1>System health</h1><p className="muted">App {APP_VERSION} · schema {DB_VERSION}. A factual view of the system; unknown or unverified behavior is not reported as healthy.</p></div></header>
    <div className="stats-grid"><article className="card stat-card"><span>Roadmaps</span><strong>{state.roadmaps.length}</strong><small>Stored locally</small></article><article className="card stat-card"><span>Task definitions</span><strong>{state.taskDefinitions.length}</strong><small>Versioned curriculum output</small></article><article className="card stat-card"><span>Daily instances</span><strong>{state.dailyTasks.length}</strong><small>Historical + current</small></article><article className="card stat-card"><span>Audits</span><strong>{state.audits.length}</strong><small>Append-only evidence records</small></article></div>
    <article className="card"><div className="card-heading"><div><span className="eyebrow">Invariant checks</span><h2>Current evidence</h2></div><span className={checks.every(([, ok]) => ok) ? 'pill success-pill' : 'pill warning'}>{checks.every(([, ok]) => ok) ? 'Healthy checks' : 'Attention required'}</span></div>{checks.map(([name, ok, detail]) => <div key={name} className="setting-row"><div><strong>{name}</strong><span>{detail}</span></div><span className={`pill ${ok ? 'success-pill' : 'warning'}`}>{ok ? 'PASS' : 'CHECK'}</span></div>)}</article>
    <article className="card" style={{ marginTop: 14 }}><span className="eyebrow">Known limits</span><h2>Not equivalent to production verification</h2><div className="checklist"><span>• Browser E2E is environment-dependent.</span><span>• Browser notifications only fire while the app is open; background push/service-worker delivery is not included.</span><span>• The optional local model adapter requires a separate local server and has not been connection-tested by saving settings.</span><span>• Full browser E2E and real IndexedDB migration runs remain environment-dependent.</span></div></article>
  </section>;
}
