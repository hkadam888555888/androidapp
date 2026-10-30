import { useEffect, useRef, useState } from 'react';
import type { DailyTask } from '../../domain/entities/models';
import { StatusBadge } from '../../components/ui/StatusBadge';

interface TaskFocusDialogProps {
  task: DailyTask;
  onClose: () => void;
  onComplete: (actualDurationMinutes?: number) => void;
  onSkip: () => void;
}
export function TaskFocusDialog({ task, onClose, onComplete, onSkip }: TaskFocusDialogProps) {
  const initialSeconds = Math.max(60, Math.round(task.plannedMinutes) * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const [expired, setExpired] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const elapsedBeforeStartRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(next);
      const elapsed = Math.min(initialSeconds, elapsedBeforeStartRef.current + initialSeconds - next);
      setElapsedSeconds(elapsed);
      if (next === 0) { deadlineRef.current = null; setRunning(false); setExpired(true); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function toggleTimer() {
    if (running) {
      if (deadlineRef.current !== null) {
        const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
        const elapsedThisRun = initialSeconds - remaining - elapsedBeforeStartRef.current;
        elapsedBeforeStartRef.current += Math.max(0, elapsedThisRun);
        setRemainingSeconds(remaining);
        setElapsedSeconds(elapsedBeforeStartRef.current);
      }
      deadlineRef.current = null; setRunning(false); return;
    }
    if (remainingSeconds <= 0) return;
    deadlineRef.current = Date.now() + remainingSeconds * 1000;
    setExpired(false); setRunning(true);
  }
  const actualDurationMinutes = elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / 60)) : undefined;
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <div className="focus-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="focus-dialog" role="dialog" aria-modal="true" aria-labelledby="focus-dialog-title" aria-describedby="focus-dialog-note">
        <div className="focus-dialog-header">
          <div><p className="eyebrow">Focused work</p><h2 id="focus-dialog-title">{task.title}</h2><StatusBadge status={task.status} /></div>
          <button type="button" className="button secondary focus-dialog-close" onClick={onClose} aria-label="Close focus timer">×</button>
        </div>
        <div className="focus-timer" aria-live="off"><strong>{minutes}:{seconds}</strong><span>{expired ? 'Time block ended' : running ? 'Timer running' : remainingSeconds === initialSeconds ? 'Ready when you are' : 'Timer paused'}</span></div>
        <p id="focus-dialog-note" className={'focus-dialog-note' + (expired ? ' expired' : '')}>
          {expired ? 'Your timer has ended. No task result was recorded. Choose what actually happened below; elapsed focus time will be attached when you complete the task.' : 'The timer tracks elapsed focus time. Closing it never marks the task complete; completing the task records the elapsed minutes automatically.'}
        </p>
        <div className="focus-dialog-actions">
          <button type="button" className="button primary" onClick={toggleTimer} disabled={remainingSeconds <= 0}>{running ? 'Pause timer' : remainingSeconds === initialSeconds ? 'Start timer' : 'Resume timer'}</button>
          <button type="button" className="button success" onClick={() => onComplete(actualDurationMinutes)}>Mark completed{actualDurationMinutes ? ` · ${actualDurationMinutes} min logged` : ''}</button>
          <button type="button" className="button danger" onClick={onSkip}>Skip task</button>
          <button type="button" className="button secondary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
