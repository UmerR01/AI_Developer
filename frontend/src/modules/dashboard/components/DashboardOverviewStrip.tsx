import type { ActivityItem, NotificationPreviewItem, PipelineSummaryItem, TaskItem } from "../types";

interface DashboardOverviewStripProps {
  pipelineSummary: PipelineSummaryItem[];
  myTasks: TaskItem[];
  recentActivity: ActivityItem[];
  notificationsPreview: NotificationPreviewItem[];
}

function formatTaskStatus(status: TaskItem["status"]): string {
  if (status === "in_progress") {
    return "In Progress";
  }
  if (status === "done") {
    return "Done";
  }
  return "To Do";
}

export function DashboardOverviewStrip({
  pipelineSummary,
  myTasks,
  recentActivity,
  notificationsPreview,
}: DashboardOverviewStripProps) {
  return (
    <section className="overview-grid" aria-label="Dashboard overview widgets">
      <article className="dashboard-card overview-card">
        <div className="card-head">
          <h2>Pipeline Summary</h2>
        </div>
        <div className="summary-grid">
          {pipelineSummary.map((item) => (
            <div key={item.id} className="summary-tile">
              <strong>{item.count}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="dashboard-card overview-card">
        <div className="card-head">
          <h2>My Tasks</h2>
        </div>
        <ul className="overview-list">
          {myTasks.map((task) => (
            <li key={task.id}>
              <span>{task.title}</span>
              <em className={`status ${task.status}`}>{formatTaskStatus(task.status)}</em>
            </li>
          ))}
        </ul>
      </article>

      <article className="dashboard-card overview-card">
        <div className="card-head">
          <h2>Recent Project Activity</h2>
        </div>
        <ul className="overview-list">
          {recentActivity.map((item) => (
            <li key={item.id}>
              <span>{item.text}</span>
              <em>{item.time}</em>
            </li>
          ))}
        </ul>
      </article>

      <article className="dashboard-card overview-card">
        <div className="card-head">
          <h2>Notifications Preview</h2>
        </div>
        <ul className="overview-list">
          {notificationsPreview.map((item) => (
            <li key={item.id}>
              <span>{item.text}</span>
              <em>{item.time}</em>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
