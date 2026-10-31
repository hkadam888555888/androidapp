import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, CheckCircle2, Clock3, Droplets, Leaf, RefreshCw, Sparkles } from 'lucide-react';
import { appStore, useAppStore } from '../../application/appStore';
import { getCurrentDate } from '../../application/appStore';
import { generateAndPersistPlan } from '../../application/planService';
import { buildDailyReview } from '../../domain/services/reviewService';
import type { DailyTask } from '../../domain/entities/models';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TaskFocusDialog } from '../tasks/TaskFocusDialog';

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTaskKind(kind: DailyTask['kind']): string {
  if (kind === 'roadmap') return 'Roadmap work';
  if (kind === 'habit') return 'Habit';
  if (kind === 'urgent') return 'Urgent work';
  return 'Personal task';
}

export function DashboardPage() {
  const state = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const date = getCurrentDate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [focusedTask, setFocusedTask] = useState<DailyTask | null>(null);

  useEffect(() => {
    const focusTaskId = (location.state as { focusTaskId?: unknown } | null)?.focusTaskId;
    if (typeof focusTaskId !== 'string') return;
    const task = state.dailyTasks.find((item) => item.id === focusTaskId && item.date === date && item.status === 'planned');
    if (task) setFocusedTask(task);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate, state.dailyTasks, date]);

  const todayTasks = state.dailyTasks
    .filter((task) => task.date === date && task.status !== 'cancelled' && task.status !== 'rescheduled')
    .sort((a, b) => (a.plannedWindow?.start ?? '').localeCompare(b.plannedWindow?.start ?? ''));
  const waterToday = state.waterLogs.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.amountMl, 0);
  const exerciseToday = state.exerciseLogs.filter((entry) => entry.date === date).reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
  const pendingReview = useMemo(() => buildDailyReview(state.dailyTasks, date), [state.dailyTasks, date]);
  const activeRoadmap = state.roadmaps.find((roadmap) => roadmap.active);
  const hasCurrentPlan = state.dayPlans.some((plan) => plan.date === date && plan.state !== 'superseded');
  const autoPlanAttemptedForDate = useRef<string | null>(null);

  useEffect(() => {
    if (!state.ready || !state.preferences?.onboardingCompleted || !activeRoadmap || hasCurrentPlan) return;
    if (autoPlanAttemptedForDate.current === date) return;
    autoPlanAttemptedForDate.current = date;
    setBusy(true);
    setNotice('Preparing today’s routine from your roadmap and available time…');
    void generateAndPersistPlan(date)
      .then(({ tasks }) => {
        const count = tasks.length;
        setNotice(count > 0
          ? 'Today’s schedule is ready: ' + count + ' block' + (count === 1 ? '' : 's') + ' planned.'
          : 'Your roadmap is saved, but no work fit today’s available time. Review your study window and capacity in Planner.');
      })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'Could not prepare today’s routine. Open Planner to retry.');
      })
      .finally(() => setBusy(false));
  }, [state.ready, state.preferences?.onboardingCompleted, activeRoadmap?.id, hasCurrentPlan, date]);

  const completed = todayTasks.filter((task) => task.status === 'completed').length;
  const reported = todayTasks.filter((task) => task.status === 'completed' || task.status === 'partial' || task.status === 'skipped').length;
  const plannedMinutes = todayTasks.reduce((sum, task) => sum + task.plannedMinutes, 0);
  const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0;
  const currentTask = todayTasks.find((task) => task.status === 'planned');
  const exerciseHabit = state.habits.find((habit) => habit.kind === 'exercise' && habit.active);
  const waterHabit = state.habits.find((habit) => habit.kind === 'water' && habit.active);
  const exerciseTarget = exerciseHabit?.targetValue ?? 0;
  const waterTarget = waterHabit?.targetValue ?? 0;
  const exercisePercent = exerciseTarget > 0 ? Math.min(100, Math.round((exerciseToday / exerciseTarget) * 100)) : 0;
  const waterPercent = waterTarget > 0 ? Math.min(100, Math.round((waterToday / waterTarget) * 100)) : 0;
  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  async function regenerate() {
    setBusy(true);
    setNotice('');
    try {
      await generateAndPersistPlan(date);
      setNotice('Today’s plan has been refreshed using your latest schedule and priorities.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not generate a plan.');
    } finally {
      setBusy(false);
    }
  }

  async function report(id: string, result: 'completed' | 'skipped', actualDurationMinutes?: number) {
    try {
      await appStore.reportTask(id, result, result === 'skipped' ? 'Skipped from Today' : undefined, actualDurationMinutes);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not record that task outcome.');
    }
  }

  const heroTitle = currentTask
    ? currentTask.title
    : todayTasks.length === 0
      ? activeRoadmap
        ? (busy ? 'Preparing your day' : hasCurrentPlan ? 'Make a little room' : 'Your first day is taking shape')
        : 'Give your day a direction'
      : pendingReview.required ? 'Close the loop on today' : 'You made it through today';
  const heroDescription = currentTask
    ? currentTask.plannedMinutes + ' minutes of ' + formatTaskKind(currentTask.kind).toLowerCase() + '. Start when you’re ready.'
    : todayTasks.length === 0
      ? activeRoadmap
        ? (busy
          ? 'Using your saved roadmap and available time to prepare a realistic schedule.'
          : hasCurrentPlan
            ? 'Nothing fits the current plan yet. Adjust your availability or priorities and try again.'
            : 'Your roadmap is saved. Your first schedule is being prepared automatically.')
        : 'Start with a roadmap and give the planner something meaningful to work with.'
      : pendingReview.required
        ? 'A few tasks still need an honest result. Nothing is marked complete unless you say so.'
        : 'Your planned work is finished. Take a moment to look back at what you accomplished.';

  return (
    <section className="page today-page">
      <header className="today-header">
        <div className="today-heading-copy">
          <p className="eyebrow">{dateLabel}</p>
          <h1>Today</h1>
          <p className="today-welcome">{greeting}. Let’s make the day feel manageable.</p>
        </div>
        <div className="today-header-actions">
          {todayTasks.length > 0 && (
            <button className="button secondary today-refresh-button" type="button" onClick={regenerate} disabled={busy}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>{busy ? 'Refreshing…' : 'Refresh plan'}</span>
            </button>
          )}
          {currentTask ? (
            <Link className="button secondary today-text-action" to="/planner">Adjust day <ArrowUpRight size={15} aria-hidden="true" /></Link>
          ) : todayTasks.length === 0 ? (
            activeRoadmap
              ? (hasCurrentPlan
                ? <Link className="button primary" to="/planner">Adjust schedule</Link>
                : <button className="button primary" type="button" onClick={regenerate} disabled={busy}>{busy ? 'Preparing…' : 'Prepare my day'}</button>)
              : <Link className="button primary" to="/roadmap">Build a roadmap</Link>
          ) : pendingReview.required ? (
            <Link className="button primary" to="/review">Review today</Link>
          ) : <Link className="button primary" to="/statistics">See progress</Link>}
        </div>
      </header>

      {pendingReview.required && (
        <div className="review-banner today-review-banner" role="status">
          <div><strong>A quick check-in is still needed</strong><span>{pendingReview.unresolvedTaskIds?.length ?? 0} task(s) need an explicit result. Nothing is assumed complete.</span></div>
          <Link className="button primary" to="/review">Finish review</Link>
        </div>
      )}
      {notice && <div className="notice-bar" role="status" aria-live="polite">{notice}</div>}

      <section className="today-hero next-session" aria-label="Next planned session">
        <div className="today-hero-copy next-session-copy">
          <div className="today-hero-kicker next-session-kicker">
            <span
              className={[
                'next-session-indicator',
                currentTask ? 'is-active' : pendingReview.required ? 'is-review' : todayTasks.length > 0 ? 'is-complete' : 'is-idle',
              ].join(' ')}
              aria-hidden="true"
            />
            <span>{currentTask ? 'UP NEXT' : pendingReview.required ? 'DAILY CHECK-IN' : todayTasks.length > 0 ? 'DAY COMPLETE' : 'YOUR DAY, YOUR PACE'}</span>
            {currentTask && <span className="next-session-time">{currentTask.plannedWindow?.start ?? 'Flexible time'}{currentTask.plannedWindow?.end ? ' – ' + currentTask.plannedWindow.end : ''}</span>}
          </div>
          <h2>{heroTitle}</h2>
          <p>{heroDescription}</p>
          <div className="today-hero-actions next-session-actions">
            {currentTask ? (
              <>
                <button className="button primary" type="button" onClick={() => setFocusedTask(currentTask)}><Sparkles size={16} aria-hidden="true" /> Start focus</button>
                <Link to="/planner" className="button secondary">Adjust schedule</Link>
              </>
            ) : todayTasks.length === 0 ? (
              <Link to={activeRoadmap ? '/planner' : '/roadmap'} className="button primary">{activeRoadmap ? 'Open planner' : 'Create your roadmap'}</Link>
            ) : pendingReview.required ? (
              <Link to="/review" className="button primary">Review day</Link>
            ) : <Link to="/statistics" className="button primary">View progress</Link>}
          </div>
        </div>

        <div className="today-progress-widget" role="group" aria-label={'Today’s progress: ' + progress + '% complete, ' + completed + ' of ' + todayTasks.length + ' tasks completed'}>
          <div className="today-progress-ring">
            <svg viewBox="0 0 112 112" aria-hidden="true" focusable="false">
              <circle className="today-progress-track" cx="56" cy="56" r="47" pathLength="100" />
              <circle className="today-progress-value" cx="56" cy="56" r="47" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - progress} />
            </svg>
            <div className="today-progress-center"><strong>{progress}%</strong><span>complete</span></div>
          </div>
          <div className="today-progress-caption"><strong>{completed} of {todayTasks.length}</strong><span>planned sessions</span></div>
        </div>
      </section>

      <section className="today-metrics stats-grid" aria-label="Today’s summary">
        <article className="card stat-card today-metric">
          <div className="today-metric-icon"><CheckCircle2 size={17} aria-hidden="true" /></div>
          <span>Tasks completed</span><strong>{completed}<small> / {todayTasks.length}</small></strong>
          <p>{reported} task outcomes recorded</p><ProgressBar value={progress} label="Today's completed tasks" />
        </article>
        <article className="card stat-card today-metric">
          <div className="today-metric-icon"><Clock3 size={17} aria-hidden="true" /></div>
          <span>Time planned</span><strong>{plannedMinutes}<small> min</small></strong>
          <p>Across today’s scheduled blocks</p>
        </article>
        <article className="card stat-card today-metric">
          <div className="today-metric-icon"><Activity size={17} aria-hidden="true" /></div>
          <span>Movement logged</span><strong>{exerciseToday}<small> min</small></strong>
          <p>{exerciseTarget > 0 ? exerciseTarget + ' min daily target' : 'No daily target set'}</p>
          {exerciseTarget > 0 && <ProgressBar value={exercisePercent} label="Movement target progress" />}
        </article>
        <article className="card stat-card today-metric">
          <div className="today-metric-icon"><Droplets size={17} aria-hidden="true" /></div>
          <span>Water logged</span><strong>{waterToday.toLocaleString()}<small> ml</small></strong>
          <p>{waterTarget > 0 ? waterTarget.toLocaleString() + ' ml daily target' : 'No daily target set'}</p>
          {waterTarget > 0 && <ProgressBar value={waterPercent} label="Water target progress" />}
        </article>
      </section>

      <div className="today-content-grid content-grid">
        <article className="card today-schedule-card large-card">
          <div className="card-heading today-section-heading">
            <div><span className="eyebrow">The plan</span><h2>Your day, in focus</h2>
              <p>{todayTasks.length > 0 ? todayTasks.length + ' planned block' + (todayTasks.length === 1 ? '' : 's') + ' · ' + reported + ' outcomes recorded' : 'A realistic plan, not a packed calendar.'}</p>
            </div>
            <Link className="today-inline-link" to="/planner">Open plan <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
          {todayTasks.length === 0 ? (
            <div className="empty-state today-empty-state">
              <div className="empty-icon"><Leaf size={21} aria-hidden="true" /></div>
              <h3>{activeRoadmap ? (busy ? 'Setting up your first sessions' : hasCurrentPlan ? 'Nothing fits just yet' : 'Your routine is being prepared') : 'Start with one clear direction'}</h3>
              <p>{activeRoadmap
                ? (busy ? 'We’re using your roadmap and available time. You can leave this page open while it prepares.' : hasCurrentPlan ? 'Review your available hours and daily capacity in Planner. Your saved roadmap is safe.' : 'Your roadmap is ready. The planner will turn it into practical sessions.')
                : 'Add a roadmap first. The planner uses it to create tasks that have context and a clear next step.'}</p>
              {activeRoadmap ? <Link className="button secondary" to="/planner">Review planning settings</Link> : <Link className="button primary" to="/roadmap">Add a roadmap</Link>}
            </div>
          ) : (
            <div className="timeline today-timeline">
              {todayTasks.map((task) => (
                <div key={task.id} className={'timeline-item ' + task.status}>
                  <div className="timeline-time">{task.plannedWindow?.start ?? 'Flexible'}{task.plannedWindow?.end && <span>{task.plannedWindow.end}</span>}</div>
                  <div className="timeline-card today-task-card">
                    <div className="today-task-copy"><strong>{task.title}</strong><span>{task.plannedMinutes} min · {formatTaskKind(task.kind)}</span></div>
                    <div className="row-actions today-task-actions">
                      {task.status === 'planned' ? (
                        <>
                          <button className="button secondary" type="button" onClick={() => setFocusedTask(task)}>Focus</button>
                          <button className="button success" type="button" onClick={() => { void report(task.id, 'completed'); }}>Complete</button>
                          <button className="button danger" type="button" onClick={() => { void report(task.id, 'skipped'); }}>Skip</button>
                        </>
                      ) : <StatusBadge status={task.status} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <aside className="today-side-column">
          <article className="card today-rhythm-card">
            <div className="card-heading"><div><span className="eyebrow">Your rhythm</span><h2>Small things count</h2></div><span className="today-leaf-mark"><Leaf size={17} aria-hidden="true" /></span></div>
            <div className="today-habit-row">
              <div className="today-habit-icon"><Droplets size={17} aria-hidden="true" /></div>
              <div className="today-habit-copy"><strong>Hydration</strong><span>{waterToday.toLocaleString()} ml {waterTarget > 0 ? 'of ' + waterTarget.toLocaleString() + ' ml' : 'logged today'}</span>{waterTarget > 0 && <ProgressBar value={waterPercent} label="Hydration target" />}</div>
              <Link to="/habits" className="today-habit-action" aria-label="Log water in Habits"><ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="today-habit-row">
              <div className="today-habit-icon movement"><Activity size={17} aria-hidden="true" /></div>
              <div className="today-habit-copy"><strong>Movement</strong><span>{exerciseToday} min {exerciseTarget > 0 ? 'of ' + exerciseTarget + ' min' : 'logged today'}</span>{exerciseTarget > 0 && <ProgressBar value={exercisePercent} label="Movement target" />}</div>
              <Link to="/habits" className="today-habit-action" aria-label="Log movement in Habits"><ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="today-roadmap-note">
              <span className="eyebrow">Current direction</span>
              <strong>{activeRoadmap?.title ?? 'No active roadmap'}</strong>
              <Link to="/roadmap">{activeRoadmap ? 'Continue your roadmap' : 'Choose a roadmap'} <ArrowUpRight size={13} aria-hidden="true" /></Link>
            </div>
          </article>

          <article className="card today-quick-card">
            <div className="card-heading"><div><span className="eyebrow">Make an adjustment</span><h2>Quick actions</h2></div></div>
            <div className="quick-grid today-quick-grid">
              <Link to="/planner" className="quick-action"><strong>Add urgent work</strong><span>Fit a new commitment into the day.</span></Link>
              <Link to="/habits" className="quick-action"><strong>Log a habit</strong><span>Record what you actually did.</span></Link>
              <Link to="/review" className="quick-action"><strong>Review the day</strong><span>Resolve unfinished tasks honestly.</span></Link>
            </div>
          </article>
        </aside>
      </div>

      {focusedTask && (
        <TaskFocusDialog
          task={focusedTask}
          onClose={() => setFocusedTask(null)}
          onComplete={(actualDurationMinutes) => { void report(focusedTask.id, 'completed', actualDurationMinutes); setFocusedTask(null); }}
          onSkip={() => { void report(focusedTask.id, 'skipped'); setFocusedTask(null); }}
        />
      )}
    </section>
  );
}
