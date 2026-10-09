import type { DailyTask } from '../../domain/entities/models';

interface TaskCardProps {
  task: DailyTask;
  onComplete?: (task: DailyTask) => void;
  onSkip?: (task: DailyTask) => void;
}

export function TaskCard({ task, onComplete, onSkip }: TaskCardProps) {
  return (
    <article className={`card task-card status-${task.status}`}>
      <div>
        <span className="eyebrow">{task.kind} · {task.plannedMinutes} min</span>
        <h3>{task.title}</h3>
      </div>
      <span className="pill">{task.status}</span>
      {task.status === 'planned' && (
        <div className="review-actions">
          <button className="button success" onClick={() => onComplete?.(task)}>Completed</button>
          <button className="button danger" onClick={() => onSkip?.(task)}>Skipped</button>
        </div>
      )}
    </article>
  );
}
