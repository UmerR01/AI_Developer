import type { ActivityItem, NotificationPreviewItem, PipelineSummaryItem, TaskItem } from "../types";

interface DashboardOverviewStripProps {
  pipelineSummary: PipelineSummaryItem[];
  myTasks: TaskItem[];
  recentActivity: ActivityItem[];
  notificationsPreview: NotificationPreviewItem[];
}

function formatTaskSize(index: number): string {
  return ["12.3 Mb", "36.7 Mb", "9.8 Mb"][index] ?? "9.8 Mb";
}

function fileExtension(index: number): string {
  return (["DOC", "PDF", "XLS"] as const)[index % 3];
}

function FileIcon({ ext }: { ext: string }) {
  const id = ext.toLowerCase();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="80" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-docGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#263d75" />
          <stop offset="100%" stopColor="#152244" />
        </linearGradient>
        <linearGradient id={`${id}-badgeGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3c5691" />
          <stop offset="100%" stopColor="#243965" />
        </linearGradient>
        <linearGradient id={`${id}-foldGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c6fa1" />
          <stop offset="100%" stopColor="#2c4376" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="transparent" rx="8" />
      <g transform="translate(2, 0)">
        <path d="M 40,20 L 72,20 L 85,33 L 85,85 L 40,85 Z" fill={`url(#${id}-docGradient)`} />
        <polygon points="72,20 72,33 85,33" fill={`url(#${id}-foldGradient)`} />
        <line x1="48" y1="70" x2="77" y2="70" stroke="#111b33" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="48" y1="76" x2="70" y2="76" stroke="#111b33" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="15" y="42" width="45" height="24" rx="5" fill={`url(#${id}-badgeGradient)`} />
        <text
          x="37.5" y="57"
          fill="#e2e8f0"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="7.5"
          fontWeight="700"
          letterSpacing="0.5"
          textAnchor="middle"
        >.{ext}</text>
      </g>
    </svg>
  );
}

function taskProgress(status: TaskItem["status"]): number {
  if (status === "done") return 100;
  if (status === "in_progress") return 23;
  return 14;
}

function getSpaceValue(item: PipelineSummaryItem | undefined, fallback: number): number {
  if (!item) return fallback;
  const value = Number(item.count);
  return Number.isFinite(value) ? value : fallback;
}

export function DashboardOverviewStrip({
  pipelineSummary,
  myTasks,
  recentActivity,
  notificationsPreview,
}: DashboardOverviewStripProps) {
  const uploadItems = myTasks.slice(0, 3);
  const documentTotal = getSpaceValue(pipelineSummary[0], 100);
  const personalTotal = getSpaceValue(pipelineSummary[1], 256);
  const latestActivity = recentActivity[0]?.text ?? "Files are synced across your team workspace.";
  const notificationCount = notificationsPreview.length;

  return (
    <>
      <article className="dashboard-card uploading-card" data-latest-activity={latestActivity} data-notification-count={notificationCount}>
        <div className="card-head upload-card-head">
          <h2>Uploading Files</h2>
          <button className="card-close-btn" type="button" aria-label="Close upload panel">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>

        <ul className="upload-list" aria-label="Uploading files">
          {uploadItems.map((task, index) => {
            const progress = taskProgress(task.status);
            const complete = progress === 100;
            const ext = fileExtension(index);

            return (
              <li className="upload-row" key={task.id}>
                <FileIcon ext={ext} />
                <span className="upload-copy">
                  <strong>{task.title}</strong>
                  <small>{formatTaskSize(index)}</small>
                </span>
                <span className="mini-progress" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </span>
                {complete ? (
                  <span className="upload-check" aria-label="Complete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </span>
                ) : (
                  <span className="upload-percent">{progress}%</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="upload-total" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={73}>
          <div className="upload-total-meta">
            <span className="upload-total-label">
              <svg className="upload-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Uploading
            </span>
            <strong>73%</strong>
          </div>
          <span className="upload-total-bar"><span style={{ width: "73%" }} /></span>
        </div>
      </article>

      <div className="spaces-section">
        <div className="spaces-toolbar">
          <div className="stat-chip">
            <span className="stat-icon" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14c2.4-4.2 5.2-4.2 8.4 0s6 4.2 8.4 0" />
                <path d="M4 10c2.4-4.2 5.2-4.2 8.4 0s6 4.2 8.4 0" opacity="0.55" />
              </svg>
            </span>
            <span>
              <small>Statistic</small>
              <strong>Last Week</strong>
            </span>
            <span className="chevron" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </span>
          </div>
          <div className="segment-control" aria-label="Workspace filter">
            <button type="button" className="segment-btn is-active">Personal</button>
            <button type="button" className="segment-btn">Team</button>
          </div>
        </div>

        <article className="dashboard-card spaces-card">
        <div className="card-head spaces-head">
          <div>
            <h2>Spaces</h2>
            <p>Use spaces to sort files by their meaning.</p>
          </div>
          <button className="add-space-btn" type="button">Add Space +</button>
        </div>

        <div className="space-card-grid">
          <div className="space-mini-card">
            <div className="space-mini-head">
              <span className="space-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="5" width="14" height="14" rx="3" />
                </svg>
              </span>
              <strong>Documents</strong>
              <span className="space-menu" aria-hidden="true">⋮</span>
            </div>
            <div className="space-stats">
              <span><strong>{documentTotal}</strong><small>Total</small></span>
              <span><strong>21 GB</strong><small>Used</small></span>
              <span><strong>79 GB</strong><small>Available</small></span>
            </div>
          </div>

          <div className="space-mini-card">
            <div className="space-mini-head">
              <span className="space-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3 14.3 9.7 21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" />
                </svg>
              </span>
              <strong>Personal</strong>
              <span className="space-menu" aria-hidden="true">⋮</span>
            </div>
            <div className="space-stats">
              <span><strong>{personalTotal}</strong><small>Total</small></span>
              <span><strong>56 GB</strong><small>Used</small></span>
              <span><strong>200 GB</strong><small>Available</small></span>
            </div>
          </div>
        </div>
        </article>
      </div>
    </>
  );
}
