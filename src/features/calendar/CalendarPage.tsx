import { useMemo, useState } from 'react';
import { useAppStore } from '../../application/appStore';

const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
function iso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function addMonths(date: Date, amount: number) { const d = new Date(date); d.setDate(1); d.setMonth(d.getMonth()+amount); return d; }

export function CalendarPage() {
  const state = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const key = monthKey(cursor);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const startOffset = (first.getDay() + 6) % 7;
  const days = useMemo(() => Array.from({length: 42}, (_, i) => { const d = new Date(first); d.setDate(1 - startOffset + i); return d; }), [key]);
  return <section className="page">
    <header className="page-header"><div><p className="eyebrow">History & forecasting</p><h1>Calendar</h1><p className="muted">Past results stay historical. Future blocks may move when reality changes.</p></div></header>
    <div className="card"><div className="calendar-toolbar"><button className="button secondary" onClick={() => setCursor(addMonths(cursor,-1))}>‹</button><h2>{cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button className="button secondary" onClick={() => setCursor(addMonths(cursor,1))}>›</button></div><div className="calendar-grid">{weekdays.map((d)=><span key={d} className="calendar-label">{d}</span>)}{days.map((d)=>{ const day=iso(d); const tasks=state.dailyTasks.filter((t)=>t.date===day && t.status!=='cancelled' && t.status!=='rescheduled'); const done=tasks.filter((t)=>t.status==='completed').length; const pending=tasks.filter((t)=>t.status==='unreported'||t.status==='planned').length; const inMonth=d.getMonth()===cursor.getMonth(); return <button key={day} className={`calendar-day ${inMonth?'':'outside-month'} ${day===iso(new Date())?'today':''}`} onClick={()=>{}}><strong>{d.getDate()}</strong>{tasks.length>0&&<small>{done}/{tasks.length}{pending>0?` · ${pending} pending`:''}</small>}</button>;})}</div></div>
  </section>;
}
