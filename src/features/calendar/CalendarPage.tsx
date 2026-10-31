import { useMemo, useState } from 'react';
import { useAppStore } from '../../application/appStore';

const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function iso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function addMonths(date: Date, amount: number) { const d = new Date(date); d.setDate(1); d.setMonth(d.getMonth()+amount); return d; }

export function CalendarPage() {
  const state = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(iso(new Date()));
  const key = monthKey(cursor);
  const days = useMemo(() => {
    const [year, month] = key.split('-').map(Number);
    const first = new Date(year, month - 1, 1, 12);
    const startOffset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(first);
      day.setDate(1 - startOffset + i);
      return day;
    });
  }, [key]);
  const selectedTasks = state.dailyTasks.filter((t) => t.date === selectedDay && t.status !== 'cancelled' && t.status !== 'rescheduled');
  const selectedDateLabel = new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">History & forecasting</p><h1>Calendar</h1><p className="muted">Past results stay historical. Future blocks may move when reality changes.</p></div></header>
    <div className="card"><div className="calendar-toolbar"><button type="button" className="button secondary" aria-label="Previous month" title="Previous month" onClick={() => setCursor(addMonths(cursor,-1))}>‹</button><h2 aria-live="polite" aria-atomic="true">{cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button type="button" className="button secondary" aria-label="Next month" title="Next month" onClick={() => setCursor(addMonths(cursor,1))}>›</button></div><div className="calendar-grid">{weekdays.map((d)=><span key={d} className="calendar-label">{d}</span>)}{days.map((d)=>{ const day=iso(d); const tasks=state.dailyTasks.filter((t)=>t.date===day && t.status!=='cancelled' && t.status!=='rescheduled'); const done=tasks.filter((t)=>t.status==='completed').length; const pending=tasks.filter((t)=>t.status==='unreported'||t.status==='planned').length; const inMonth=d.getMonth()===cursor.getMonth(); return <button key={day} className={"calendar-day " + (inMonth ? "" : "outside-month") + (day === iso(new Date()) ? " today" : "") + (day === selectedDay ? " selected" : "")} onClick={() => setSelectedDay(day)} aria-pressed={day === selectedDay} aria-label={"Select " + day + (tasks.length ? ", " + tasks.length + " tasks" : ", no tasks")}><strong>{d.getDate()}</strong>{tasks.length>0&&<small>{done}/{tasks.length}{pending>0?` · ${pending} pending`:''}</small>}</button>;})}</div></div>
    <article className="card calendar-day-detail" aria-live="polite">
      <div className="card-heading"><div><span className="eyebrow">Selected day</span><h2>{selectedDateLabel}</h2></div><span className="pill">{selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'}</span></div>
      {selectedTasks.length === 0 ? <div className="empty-state compact"><h3>No recorded tasks</h3><p>There are no tasks saved for this date. Empty days stay empty rather than being counted as completed.</p></div> : selectedTasks.map((task) => <div className="calendar-task-row" key={task.id}><div><strong>{task.title}</strong><span>{task.plannedWindow?.start ? task.plannedWindow.start + '–' + (task.plannedWindow.end ?? '') + ' · ' : ''}{task.plannedMinutes} min · {task.kind}</span></div><span className="pill calendar-status">{task.status === 'unreported' ? 'Needs review' : task.status === 'rescheduled' ? 'Moved' : task.status}</span></div>)}
    </article>
  </section>;
}
