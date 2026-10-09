import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { appStore, useAppStore } from '../../application/appStore';
import { localISODate } from '../../application/date';
import type { PlannerMode } from '../../domain/entities/models';
import { normalizeLocalEndpoint, OpenAICompatibleLocalProvider } from '../../domain/ai/openAICompatibleLocalProvider';

export function SettingsPage() {
  const state = useAppStore();
  const prefs = state.preferences;
  const plannerSettings = state.plannerSettings;
  const [studyMinutes, setStudyMinutes] = useState(prefs?.maxStudyMinutesPerDay ?? 240);
  const [focusMinutes, setFocusMinutes] = useState(prefs?.maxContinuousFocusMinutes ?? 90);
  const [buffer, setBuffer] = useState(prefs?.bufferPercentage ?? 15);
  const [mode, setMode] = useState<PlannerMode>(plannerSettings?.activeMode ?? 'normal');
  const [busyCapacity, setBusyCapacity] = useState(plannerSettings?.busyCapacityMinutes ?? 120);
  const [examCapacity, setExamCapacity] = useState(plannerSettings?.examCapacityMinutes ?? 180);
  const [modeUntil, setModeUntil] = useState(plannerSettings?.modeActiveUntil ?? '');
  const [examRoadmapIds, setExamRoadmapIds] = useState<string[]>(plannerSettings?.examRoadmapIds ?? []);
  const [notice, setNotice] = useState('');
  const [localOnly, setLocalOnly] = useState(state.aiSettings?.localOnly ?? true);
  const [retainAIHistory, setRetainAIHistory] = useState(state.aiSettings?.retainHistory ?? true);
  const [explanationMode, setExplanationMode] = useState(state.aiSettings?.explanationMode ?? 'short');
  const [providerName, setProviderName] = useState(state.aiSettings?.providerName ?? 'RuleBasedProvider');
  const [localEndpoint, setLocalEndpoint] = useState(state.aiSettings?.localEndpoint ?? 'http://127.0.0.1:1234/v1/chat/completions');
  const [localModel, setLocalModel] = useState(state.aiSettings?.localModel ?? 'local-model');
  const [notificationsEnabled, setNotificationsEnabled] = useState(prefs?.notificationsEnabled ?? false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [testingLocalAI, setTestingLocalAI] = useState(false);

  async function save() {
    if (!prefs || !plannerSettings) return;
    if (studyMinutes < 0 || focusMinutes < 1 || buffer < 0 || buffer > 90 || busyCapacity < 0 || examCapacity < 0) { setNotice('Use valid capacity values.'); return; }
    try {
      const endpoint = providerName === 'OpenAICompatibleLocalProvider' ? normalizeLocalEndpoint(localEndpoint) : undefined;
      if (providerName === 'OpenAICompatibleLocalProvider' && !localModel.trim()) {
        setNotice('Enter the model identifier configured in your local model server.');
        return;
      }
      const nextPreferences = { ...prefs, maxStudyMinutesPerDay: Math.round(studyMinutes), maxCognitiveMinutesPerDay: Math.round(studyMinutes), maxContinuousFocusMinutes: Math.round(focusMinutes), bufferPercentage: buffer, notificationsEnabled };
      const nextPlannerSettings = { ...plannerSettings, activeMode: mode, busyCapacityMinutes: Math.round(busyCapacity), examCapacityMinutes: Math.round(examCapacity), modeActiveUntil: modeUntil || undefined, examRoadmapIds };
      const nextAISettings = { id: 'ai-settings' as const, localOnly: true, cloudEnabled: false, explanationMode: explanationMode as 'short' | 'detailed', retainHistory: retainAIHistory, providerName, localEndpoint: endpoint, localModel: providerName === 'OpenAICompatibleLocalProvider' ? localModel.trim().slice(0, 160) : undefined };
      await appStore.saveSettingsBundle(nextPreferences, nextPlannerSettings, nextAISettings);
      setLocalOnly(true);
      setNotice(providerName === 'OpenAICompatibleLocalProvider' ? 'Settings saved locally. Test the endpoint to verify the local server, CORS policy, and model identifier.' : 'Settings saved locally. The deterministic offline provider is active.');
    } catch (error) {
      setNotice(`Settings were not saved: ${error instanceof Error ? error.message : 'storage operation failed.'}`);
    }
  }

  async function testLocalAI() {
    setTestingLocalAI(true);
    try {
      const endpoint = normalizeLocalEndpoint(localEndpoint);
      if (!localModel.trim()) throw new Error('Enter your local model identifier first.');
      const provider = new OpenAICompatibleLocalProvider({ endpoint, model: localModel.trim(), timeoutMs: 15_000 });
      const result = await provider.analyzeProgress({ completed: 1, skipped: 0, unreported: 0 });
      setNotice(`Local model connection succeeded: ${result.summary}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Local model connection failed.');
    } finally { setTestingLocalAI(false); }
  }

  function toggleExamRoadmap(id: string) {
    setExamRoadmapIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function exportBackup() {
    try {
      const payload = await appStore.exportBackup();
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `my-adaptive-routine-backup-${localISODate(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice('Backup exported. It may contain routine and progress data.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Backup export failed.'); }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try { await appStore.importBackup(await file.text()); setNotice('Backup restored successfully.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Backup import failed.'); }
    event.target.value = '';
  }

  const activeRoadmaps = state.roadmaps.filter((roadmap) => roadmap.active);

  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">Local configuration</p><h1>Settings</h1><p className="muted">Control global planning capacity without changing task history.</p><p className="muted small-copy">Read the <Link to="/privacy">privacy and data-handling notice</Link>.</p></div></header>
    {notice && <div className="notice-bar">{notice}</div>}
    <div className="settings-grid">
      <article className="card"><span className="eyebrow">Planner policy</span><h2>Capacity</h2><div className="setting-form">
        <label>Normal max study minutes/day<input type="number" min="0" value={studyMinutes} onChange={(e) => setStudyMinutes(Number(e.target.value))} /></label>
        <label>Max continuous focus<input type="number" min="1" value={focusMinutes} onChange={(e) => setFocusMinutes(Number(e.target.value))} /></label>
        <label>Protected buffer %<input type="number" min="0" max="90" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} /></label>
        <label className="setting-row"><span><strong>Browser reminder delivery</strong><small>Only works while this app is open and permission is granted.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} /></label>
      </div></article>

      <article className="card"><span className="eyebrow">v0.5</span><h2>Capacity mode</h2><p className="muted small-copy">Modes are explicit and temporary. After the selected end date, planning returns to normal automatically.</p>
        <div className="setting-form">
          <label>Mode<select value={mode} onChange={(e) => setMode(e.target.value as PlannerMode)}><option value="normal">Normal</option><option value="busy">Busy day</option><option value="exam">Exam / deadline</option></select></label>
          <label>Busy capacity<input type="number" min="0" value={busyCapacity} onChange={(e) => setBusyCapacity(Number(e.target.value))} /></label>
          <label>Exam capacity<input type="number" min="0" value={examCapacity} onChange={(e) => setExamCapacity(Number(e.target.value))} /></label>
          <label>Active until (optional)<input type="date" value={modeUntil} onChange={(e) => setModeUntil(e.target.value)} /></label>
          {mode === 'exam' && <div><span className="eyebrow">Exam focus roadmaps</span><div className="checklist" style={{ marginTop: 10 }}>{activeRoadmaps.length === 0 ? <span>No active roadmaps.</span> : activeRoadmaps.map((roadmap) => <label key={roadmap.id} className="setting-row"><span><strong>{roadmap.title}</strong><small>{roadmap.priority ?? 'medium'} priority</small></span><input type="checkbox" checked={examRoadmapIds.includes(roadmap.id)} onChange={() => toggleExamRoadmap(roadmap.id)} /></label>)}</div></div>}
          <button className="button primary" onClick={save}>Save planner settings</button>
        </div>
      </article>

      <article className="card"><span className="eyebrow">v1.0.5</span><h2>Local AI & privacy</h2><p className="muted small-copy">AI requests remain local-only. The optional OpenAI-compatible adapter accepts loopback endpoints only; it does not call a cloud API.</p><div className="setting-form"><label>Provider<select value={providerName} onChange={(e) => setProviderName(e.target.value)}><option value="RuleBasedProvider">Built-in deterministic provider (offline)</option><option value="OpenAICompatibleLocalProvider">Local model server (OpenAI-compatible)</option></select></label>{providerName === 'OpenAICompatibleLocalProvider' && <><label>Local endpoint<input value={localEndpoint} onChange={(e) => setLocalEndpoint(e.target.value)} placeholder="http://127.0.0.1:1234/v1/chat/completions" autoComplete="off" /></label><label>Model identifier<input value={localModel} onChange={(e) => setLocalModel(e.target.value)} placeholder="Your local model name" autoComplete="off" /></label><p className="muted small-copy">Start your local server separately (for example, LM Studio or another OpenAI-compatible local runtime). Keep it bound to loopback. The app never stores an API key.</p><button className="button secondary" onClick={() => void testLocalAI()} disabled={testingLocalAI}>{testingLocalAI ? 'Testing local endpoint…' : 'Test local endpoint'}</button></>}<label className="setting-row"><span><strong>Local-only mode</strong><small>Cloud AI is disabled in this release.</small></span><input type="checkbox" checked={localOnly} disabled aria-label="Local-only AI enabled" /></label><label className="setting-row"><span><strong>Retain AI history</strong><small>Store validated analysis/proposal artifacts.</small></span><input type="checkbox" checked={retainAIHistory} onChange={(e) => setRetainAIHistory(e.target.checked)} /></label><label>Explanation detail<select value={explanationMode} onChange={(e) => setExplanationMode(e.target.value as 'short' | 'detailed')}><option value="short">Short</option><option value="detailed">Detailed</option></select></label><button className="button secondary" onClick={async () => { try { await appStore.deleteAIHistory(); setNotice('AI artifact history deleted locally.'); } catch (error) { setNotice(`AI history could not be deleted: ${error instanceof Error ? error.message : 'storage operation failed.'}`); } }}>Delete AI history</button></div><div className="checklist"><span>✓ AI cannot mark task completion</span><span>✓ AI cannot bypass planner validation</span><span>✓ Uncertain suggestions remain advisory</span><span>✓ Provider is replaceable</span></div></article>

      <article className="card"><span className="eyebrow">Global pool</span><h2>Active roadmaps</h2><p className="muted small-copy">All active roadmaps can compete for the same daily capacity. Capacity shares are soft guardrails, not hard walls for urgent or deadline-protected work.</p>{activeRoadmaps.length === 0 ? <div className="empty-state compact"><h3>No active roadmap</h3><p>Add a roadmap to begin planning.</p></div> : activeRoadmaps.map((roadmap) => <div className="setting-row" key={roadmap.id}><div><strong>{roadmap.title}</strong><span>{roadmap.priority ?? 'medium'} priority · {roadmap.capacitySharePercentage === undefined ? 'flexible share' : `${roadmap.capacitySharePercentage}% share`}</span></div><span className="pill">ACTIVE</span></div>)}</article>

      <article className="card"><span className="eyebrow">Data safety</span><h2>Backup & restore</h2><p className="muted">Backup files contain routine, task, habit, external-work, planner, and history data. They are not transmitted automatically.</p><div className="toolbar"><button className="button primary" onClick={exportBackup}>Export JSON backup</button><label className="button secondary file-button">Import JSON<input type="file" accept="application/json" onChange={importBackup} /></label></div><div className="checklist"><span>✓ Schema migration to v9</span><span>✓ Local IndexedDB storage + persisted AI artifacts</span><span>✓ Multi-roadmap planning is additive</span><span>✓ Planner cannot mark history complete</span></div><div className="danger-zone"><h3>Delete all local data</h3><p className="muted small-copy">Permanently clears roadmaps, curriculum, task history, habits, analytics, notifications, AI artifacts, settings, and audit records from this browser. Export a backup first if you may need it.</p><label>Type DELETE to confirm<input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} autoComplete="off" /></label><button className="button danger" disabled={deleteConfirmation !== 'DELETE'} onClick={async () => { try { await appStore.deleteAllLocalData(); setDeleteConfirmation(''); setNotice('All local app data was cleared. Start again with first-run setup.'); } catch (error) { setNotice(`Local data could not be fully cleared: ${error instanceof Error ? error.message : 'storage operation failed.'}`); } }}>Delete all local data</button></div></article>
    </div>
  </section>;
}
