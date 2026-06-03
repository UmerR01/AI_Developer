"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getStoredAccessToken, getStoredUsername } from "../../auth/session";
import { DashboardSidebar } from "../../dashboard/components/DashboardSidebar";
import { DashboardTopBar } from "../../dashboard/components/DashboardTopBar";
import { DASHBOARD_DATA } from "../../dashboard/data/mockDashboardData";
import type { Account } from "../../dashboard/types";
import "../../dashboard/dashboard.css";
import "../tasks.css";

type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
type Priority = "high" | "medium" | "low";
type TaskType = "research" | "frontend" | "backend" | "audit" | "db";
type QaPushState = "not_pushed" | "awaiting" | "approved" | "rejected";

type AdminFilter = "all" | TaskStatus;
type QaFilter = "all" | "pending_review" | "pushed" | "resolved";

interface TaskItem {
  id: string;
  name: string;
  description: string;
  projectName: string;
  status: TaskStatus;
  priority: Priority;
  type: TaskType;
  assigneeUsernames: string[];
  createdAt: string;
  commentsCount: number;
  mentionsCount: number;
  hasUnreadQaComment?: boolean;
}

interface TaskComment {
  id: string;
  taskId: string;
  authorUsername: string;
  role: Account["role"];
  timestamp: string;
  text: string;
  qaReview?: boolean;
  pendingPush?: boolean;
  internal?: boolean;
}

interface QaApprovalItem {
  id: string;
  taskId: string;
  qaUsername: string;
  timestamp: string;
  preview: string;
}

function roleLabel(role: Account["role"]): string {
  if (role === "admin") {
    return "Admin";
  }
  if (role === "developer") {
    return "Developer";
  }
  if (role === "qa") {
    return "QA";
  }
  return "Support";
}

function taskStatusLabel(status: TaskStatus): string {
  if (status === "todo") {
    return "To Do";
  }
  if (status === "in_progress") {
    return "In Progress";
  }
  if (status === "in_review") {
    return "In Review";
  }
  return "Done";
}

function taskTypeLabel(type: TaskType): string {
  if (type === "db") {
    return "DB";
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function pushStateLabel(state: QaPushState): string {
  if (state === "not_pushed") {
    return "Not Pushed";
  }
  if (state === "awaiting") {
    return "Awaiting Approval";
  }
  if (state === "approved") {
    return "Approved & Sent";
  }
  return "Rejected";
}

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M9 4v16M15 4v16M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const TASK_DATA: TaskItem[] = [
  {
    id: "task-a1",
    name: "Review Queue Banner Integration",
    description: "Inject pending QA review banner with right drawer workflow and action states.",
    projectName: "AI Agent Workspace",
    status: "in_review",
    priority: "high",
    type: "frontend",
    assigneeUsernames: ["ibrahim", "ismail"],
    createdAt: "Apr 18, 2026",
    commentsCount: 7,
    mentionsCount: 3,
    hasUnreadQaComment: true,
  },
  {
    id: "task-a2",
    name: "Role capability matrix enforcement",
    description: "Apply interaction guards for QA and Developer actions against workflow rules.",
    projectName: "Projects Module Foundation",
    status: "in_progress",
    priority: "medium",
    type: "backend",
    assigneeUsernames: ["ismail"],
    createdAt: "Apr 19, 2026",
    commentsCount: 3,
    mentionsCount: 1,
  },
  {
    id: "task-a3",
    name: "Regression test plan for approval flow",
    description: "Design QA scenarios for rejection notes and resubmission flow.",
    projectName: "Testing and QC Suite",
    status: "todo",
    priority: "high",
    type: "audit",
    assigneeUsernames: ["zahid", "faizan"],
    createdAt: "Apr 20, 2026",
    commentsCount: 2,
    mentionsCount: 0,
  },
  {
    id: "task-a4",
    name: "Task timeline event emitter",
    description: "Emit structured timeline events for task creation, status updates, and mentions.",
    projectName: "AI Agent Workspace",
    status: "done",
    priority: "low",
    type: "backend",
    assigneeUsernames: ["ibrahim"],
    createdAt: "Apr 14, 2026",
    commentsCount: 5,
    mentionsCount: 2,
  },
  {
    id: "task-a5",
    name: "Developer split view UX alignment",
    description: "Refine two-panel proportions and sticky action bar behavior on medium screens.",
    projectName: "Projects Module Foundation",
    status: "in_progress",
    priority: "medium",
    type: "frontend",
    assigneeUsernames: ["ismail"],
    createdAt: "Apr 17, 2026",
    commentsCount: 4,
    mentionsCount: 1,
    hasUnreadQaComment: true,
  },
  {
    id: "task-a6",
    name: "QA push state indicator chips",
    description: "Implement status chip variants and icon semantics for push states.",
    projectName: "Testing and QC Suite",
    status: "in_review",
    priority: "low",
    type: "research",
    assigneeUsernames: ["zahid"],
    createdAt: "Apr 21, 2026",
    commentsCount: 1,
    mentionsCount: 0,
  },
  {
    id: "task-a7",
    name: "Support escalation audit notes",
    description: "Collect incident snapshots and attach labels for team triage handoff.",
    projectName: "Support Workflow Revamp",
    status: "todo",
    priority: "medium",
    type: "db",
    assigneeUsernames: ["faizan"],
    createdAt: "Apr 19, 2026",
    commentsCount: 2,
    mentionsCount: 2,
  },
  {
    id: "task-a8",
    name: "Board drag and reorder polish",
    description: "Polish card drag state styling and keyboard support hints for admin board.",
    projectName: "AI Agent Workspace",
    status: "in_progress",
    priority: "low",
    type: "frontend",
    assigneeUsernames: ["ibrahim", "ismail"],
    createdAt: "Apr 16, 2026",
    commentsCount: 6,
    mentionsCount: 1,
  },
  {
    id: "task-a9",
    name: "Approval API observability",
    description: "Add correlation IDs and metrics around QA approval and rejection events.",
    projectName: "Projects Module Foundation",
    status: "todo",
    priority: "high",
    type: "backend",
    assigneeUsernames: ["ibrahim"],
    createdAt: "Apr 21, 2026",
    commentsCount: 1,
    mentionsCount: 0,
  },
  {
    id: "task-a10",
    name: "Agent output summarizer",
    description: "Generate concise logs for collapsible activity blocks across views.",
    projectName: "Testing and QC Suite",
    status: "done",
    priority: "medium",
    type: "research",
    assigneeUsernames: ["zahid", "faizan"],
    createdAt: "Apr 15, 2026",
    commentsCount: 4,
    mentionsCount: 1,
  },
];

const COMMENTS: TaskComment[] = [
  {
    id: "c1",
    taskId: "task-a1",
    authorUsername: "zahid",
    role: "qa",
    timestamp: "10m ago",
    text: "Validation notes are ready. Please approve and push to agent.",
    qaReview: true,
    pendingPush: true,
  },
  {
    id: "c2",
    taskId: "task-a1",
    authorUsername: "ismail",
    role: "developer",
    timestamp: "30m ago",
    text: "UI alignment fixed for compact breakpoints.",
  },
  {
    id: "c3",
    taskId: "task-a2",
    authorUsername: "ibrahim",
    role: "admin",
    timestamp: "1h ago",
    text: "Keep role guards centralized under capability resolver.",
    internal: true,
  },
  {
    id: "c4",
    taskId: "task-a5",
    authorUsername: "faizan",
    role: "qa",
    timestamp: "22m ago",
    text: "Edge case on 768px still clips the action bar.",
    qaReview: true,
    pendingPush: true,
  },
  {
    id: "c5",
    taskId: "task-a6",
    authorUsername: "zahid",
    role: "qa",
    timestamp: "5m ago",
    text: "Chip icon semantics verified in review branch.",
    qaReview: true,
  },
  {
    id: "c6",
    taskId: "task-a7",
    authorUsername: "faizan",
    role: "qa",
    timestamp: "2h ago",
    text: "Previous submission rejected due to missing evidence attachments.",
    qaReview: true,
  },
];

const QA_APPROVAL_ITEMS: QaApprovalItem[] = [
  {
    id: "qa-1",
    taskId: "task-a1",
    qaUsername: "zahid",
    timestamp: "10m ago",
    preview: "Validation notes are ready. Please approve and push to agent.",
  },
  {
    id: "qa-2",
    taskId: "task-a5",
    qaUsername: "faizan",
    timestamp: "22m ago",
    preview: "Edge case on 768px still clips the action bar.",
  },
  {
    id: "qa-3",
    taskId: "task-a7",
    qaUsername: "faizan",
    timestamp: "2h ago",
    preview: "Need escalation metadata before push to agent.",
  },
];

const DEFAULT_QA_PUSH_STATE: Record<string, QaPushState> = {
  "task-a1": "awaiting",
  "task-a3": "not_pushed",
  "task-a5": "awaiting",
  "task-a6": "approved",
  "task-a7": "rejected",
  "task-a10": "approved",
};

const STATUS_COLUMNS: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

export function TasksWorkspaceShell() {
  const router = useRouter();

  const [tokenReady, setTokenReady] = useState(false);
  const [activeUsername, setActiveUsername] = useState("ibrahim");

  const [tasks, setTasks] = useState<TaskItem[]>(TASK_DATA);
  const [columnVisibleCount, setColumnVisibleCount] = useState<Record<TaskStatus, number>>({
    todo: 4,
    in_progress: 4,
    in_review: 4,
    done: 4,
  });

  const [adminFilter, setAdminFilter] = useState<AdminFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string>(TASK_DATA[0].id);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const [reviewBannerVisible, setReviewBannerVisible] = useState(true);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [approvalItems, setApprovalItems] = useState<QaApprovalItem[]>(QA_APPROVAL_ITEMS);
  const [rejectOpenForId, setRejectOpenForId] = useState<string | null>(null);
  const [rejectNoteById, setRejectNoteById] = useState<Record<string, string>>({});

  const [activityExpanded, setActivityExpanded] = useState(true);
  const [agentOutputExpanded, setAgentOutputExpanded] = useState(true);

  const [developerFilter, setDeveloperFilter] = useState<AdminFilter>("all");
  const [qaFilter, setQaFilter] = useState<QaFilter>("all");
  const [commentInput, setCommentInput] = useState("");
  const [qaDraftText, setQaDraftText] = useState("");

  const [qaPushStateByTask, setQaPushStateByTask] = useState<Record<string, QaPushState>>(DEFAULT_QA_PUSH_STATE);
  const [qaRejectionNoteByTask, setQaRejectionNoteByTask] = useState<Record<string, string>>({
    "task-a7": "Need clearer evidence and linked screenshots before approval.",
  });

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUsername = getStoredUsername();
    if (storedUsername) {
      setActiveUsername(storedUsername);
    }

    setTokenReady(true);
  }, [router]);

  const accountByUsername = useMemo(() => {
    return DASHBOARD_DATA.accounts.reduce<Record<string, Account>>((accumulator, account) => {
      accumulator[account.username] = account;
      return accumulator;
    }, {});
  }, []);

  const activeAccount = useMemo<Account>(() => {
    return DASHBOARD_DATA.accounts.find((account) => account.username === activeUsername) ?? DASHBOARD_DATA.accounts[0];
  }, [activeUsername]);

  const roleNotifications = useMemo(() => {
    return DASHBOARD_DATA.notificationsPreview.filter((notification) => notification.visibleTo.includes(activeAccount.role));
  }, [activeAccount.role]);

  const selectedTask = useMemo(() => {
    return tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  }, [selectedTaskId, tasks]);

  const selectedTaskComments = useMemo(() => {
    return COMMENTS.filter((comment) => comment.taskId === selectedTask?.id).filter((comment) => {
      if (activeAccount.role === "qa") {
        return !comment.internal;
      }
      return true;
    });
  }, [activeAccount.role, selectedTask?.id]);

  const taskBuckets = useMemo(() => {
    const filtered = adminFilter === "all" ? tasks : tasks.filter((task) => task.status === adminFilter);
    return STATUS_COLUMNS.reduce<Record<TaskStatus, TaskItem[]>>((accumulator, status) => {
      accumulator[status] = filtered.filter((task) => task.status === status);
      return accumulator;
    }, { todo: [], in_progress: [], in_review: [], done: [] });
  }, [adminFilter, tasks]);

  const myTasks = useMemo(() => {
    const assigned = tasks.filter((task) => task.assigneeUsernames.includes(activeAccount.username));
    if (activeAccount.role === "developer") {
      if (developerFilter === "all") {
        return assigned;
      }
      return assigned.filter((task) => task.status === developerFilter);
    }

    if (activeAccount.role === "qa") {
      if (qaFilter === "all") {
        return assigned;
      }
      if (qaFilter === "pending_review") {
        return assigned.filter((task) => qaPushStateByTask[task.id] === "not_pushed" || qaPushStateByTask[task.id] === "rejected");
      }
      if (qaFilter === "pushed") {
        return assigned.filter((task) => qaPushStateByTask[task.id] === "awaiting" || qaPushStateByTask[task.id] === "approved");
      }
      return assigned.filter((task) => task.status === "done");
    }

    return assigned;
  }, [activeAccount.role, activeAccount.username, developerFilter, qaFilter, qaPushStateByTask, tasks]);

  const handleDrop = (targetStatus: TaskStatus) => {
    if (activeAccount.role !== "admin" || !dragTaskId) {
      return;
    }

    setTasks((current) => current.map((task) => (task.id === dragTaskId ? { ...task, status: targetStatus } : task)));
    setDragTaskId(null);
  };

  const addAdminTask = (status: TaskStatus) => {
    if (activeAccount.role !== "admin") {
      return;
    }

    const newTask: TaskItem = {
      id: `task-new-${Date.now()}`,
      name: `New ${taskStatusLabel(status)} Task`,
      description: "Drafted from admin board. Define scope before assigning.",
      projectName: "AI Agent Workspace",
      status,
      priority: "medium",
      type: "frontend",
      assigneeUsernames: [activeAccount.username],
      createdAt: "Today",
      commentsCount: 0,
      mentionsCount: 0,
    };

    setTasks((current) => [newTask, ...current]);
  };

  const approveItem = (item: QaApprovalItem) => {
    setApprovalItems((current) => current.filter((entry) => entry.id !== item.id));
    setQaPushStateByTask((current) => ({ ...current, [item.taskId]: "approved" }));
  };

  const rejectItem = (item: QaApprovalItem) => {
    const note = rejectNoteById[item.id]?.trim();
    if (!note) {
      return;
    }

    setApprovalItems((current) => current.filter((entry) => entry.id !== item.id));
    setQaPushStateByTask((current) => ({ ...current, [item.taskId]: "rejected" }));
    setQaRejectionNoteByTask((current) => ({ ...current, [item.taskId]: note }));
    setRejectOpenForId(null);
  };

  const renderAdminView = () => {
    return (
      <section className="task-page-wrap">
        {reviewBannerVisible && approvalItems.length > 0 ? (
          <section className="qa-review-banner">
            <div>
              <strong>{approvalItems.length} QA pushes awaiting your review</strong>
              <p>Approve or reject pending QA comments before they are sent to the AI Agent.</p>
            </div>
            <div className="qa-review-banner-actions">
              <button type="button" className="review-now-btn" onClick={() => setReviewDrawerOpen(true)}>
                Review Now
              </button>
              <button type="button" className="banner-dismiss-btn" onClick={() => setReviewBannerVisible(false)}>
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        <section className="task-filter-head">
          <div className="task-filter-pills">
            {(["all", "todo", "in_progress", "in_review", "done"] as AdminFilter[]).map((value) => (
              <button key={value} type="button" className={adminFilter === value ? "active" : ""} onClick={() => setAdminFilter(value)}>
                {value === "all" ? "All" : taskStatusLabel(value)}
              </button>
            ))}
          </div>
        </section>

        <section className="admin-board-grid">
          {STATUS_COLUMNS.map((status) => {
            const tasksInColumn = taskBuckets[status];
            const visibleCount = columnVisibleCount[status];
            const visibleTasks = tasksInColumn.slice(0, visibleCount);
            const hasMore = tasksInColumn.length > visibleCount;

            return (
              <article
                key={status}
                className="admin-task-column"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDrop(status)}
              >
                <header className="admin-column-head">
                  <strong>{taskStatusLabel(status)}</strong>
                  <span>{tasksInColumn.length}</span>
                  <button type="button" onClick={() => addAdminTask(status)}>
                    +
                  </button>
                </header>

                <div className="admin-column-list">
                  {visibleTasks.map((task) => (
                    <article
                      key={task.id}
                      className={`admin-task-card priority-${task.priority} ${dragTaskId === task.id ? "dragging" : ""}`}
                      draggable={activeAccount.role === "admin"}
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => setDragTaskId(null)}
                    >
                      <div className="task-chip-row">
                        <span className={`task-chip priority-${task.priority}`}>{task.priority}</span>
                        <span className={`task-chip type-${task.type}`}>{taskTypeLabel(task.type)}</span>
                      </div>
                      <h4>{task.name}</h4>
                      <p>{task.description}</p>
                      <footer>
                        <span>{task.createdAt}</span>
                        <span className="small-badge">C {task.commentsCount}</span>
                        <span className="small-badge">@ {task.mentionsCount}</span>
                      </footer>
                    </article>
                  ))}
                </div>

                {hasMore ? (
                  <button
                    type="button"
                    className="load-more-column"
                    onClick={() =>
                      setColumnVisibleCount((current) => ({
                        ...current,
                        [status]: current[status] + 4,
                      }))
                    }
                  >
                    Load More
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>

        {reviewDrawerOpen ? (
          <div className="approval-drawer-backdrop" onClick={() => setReviewDrawerOpen(false)}>
            <aside className="approval-drawer" onClick={(event) => event.stopPropagation()}>
              <header>
                <h3>Pending QA Approvals</h3>
                <button type="button" onClick={() => setReviewDrawerOpen(false)} aria-label="Close approvals drawer">
                  <IconClose />
                </button>
              </header>

              <ul>
                {approvalItems.map((item) => {
                  const qaMember = accountByUsername[item.qaUsername];
                  const task = tasks.find((taskItem) => taskItem.id === item.taskId);
                  if (!qaMember || !task) {
                    return null;
                  }

                  return (
                    <li key={item.id}>
                      <div className="approval-main">
                        <img src={qaMember.avatarUrl} alt={qaMember.displayName} />
                        <div>
                          <strong>
                            {qaMember.displayName} on {task.name}
                          </strong>
                          <span>
                            {task.projectName} | {item.timestamp}
                          </span>
                          <p>{item.preview}</p>
                        </div>
                      </div>

                      <div className="approval-actions">
                        <button type="button" className="approve-btn" onClick={() => approveItem(item)}>
                          Approve & Push
                        </button>
                        <button
                          type="button"
                          className="reject-btn"
                          onClick={() => setRejectOpenForId((current) => (current === item.id ? null : item.id))}
                        >
                          Reject
                        </button>
                      </div>

                      {rejectOpenForId === item.id ? (
                        <div className="reject-inline-form">
                          <input
                            type="text"
                            value={rejectNoteById[item.id] ?? ""}
                            onChange={(event) => setRejectNoteById((current) => ({ ...current, [item.id]: event.target.value }))}
                            placeholder="Write rejection note"
                          />
                          <button type="button" onClick={() => rejectItem(item)}>
                            Confirm Reject
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </aside>
          </div>
        ) : null}
      </section>
    );
  };

  const renderDeveloperOrQaView = () => {
    const isQA = activeAccount.role === "qa";

    return (
      <section className="task-split-wrap">
        <aside className="task-split-left">
          <header className="split-left-head">
            <h3>{isQA ? "Review Queue" : "My Tasks"}</h3>
            <span>{myTasks.length}</span>
          </header>

          <div className="split-filter-pills">
            {isQA
              ? (["all", "pending_review", "pushed", "resolved"] as QaFilter[]).map((value) => (
                  <button key={value} type="button" className={qaFilter === value ? "active" : ""} onClick={() => setQaFilter(value)}>
                    {value === "all"
                      ? "All"
                      : value === "pending_review"
                        ? "Pending Review"
                        : value === "pushed"
                          ? "Pushed"
                          : "Resolved"}
                  </button>
                ))
              : (["all", "todo", "in_progress", "in_review", "done"] as AdminFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={developerFilter === value ? "active" : ""}
                    onClick={() => setDeveloperFilter(value)}
                  >
                    {value === "all" ? "All" : taskStatusLabel(value)}
                  </button>
                ))}
          </div>

          <div className="split-task-list">
            {myTasks.map((task) => (
              <article
                key={task.id}
                className={`split-task-card priority-${task.priority} ${selectedTask?.id === task.id ? "active" : ""}`}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="split-task-main">
                  <strong>{task.name}</strong>
                  <span className={`task-chip type-${task.type}`}>{taskTypeLabel(task.type)}</span>
                </div>

                {isQA ? (
                  <p className={`qa-push-chip state-${qaPushStateByTask[task.id] ?? "not_pushed"}`}>
                    {pushStateLabel(qaPushStateByTask[task.id] ?? "not_pushed")}
                  </p>
                ) : (
                  <span className={`task-chip status-${task.status}`}>{taskStatusLabel(task.status)}</span>
                )}

                <footer>
                  <span>{task.createdAt}</span>
                  <span className={`small-badge ${task.hasUnreadQaComment ? "unread" : ""}`}>
                    {task.commentsCount}
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </aside>

        <section className="task-split-right">
          <header className="split-right-head">
            <h2>{selectedTask?.name}</h2>
            <div className="right-chip-row">
              <span className={`task-chip priority-${selectedTask?.priority ?? "medium"}`}>{selectedTask?.priority}</span>
              <span className={`task-chip type-${selectedTask?.type ?? "frontend"}`}>{taskTypeLabel(selectedTask?.type ?? "frontend")}</span>
            </div>
          </header>

          <p className="task-detail-description">{selectedTask?.description}</p>

          <section className="collapsible-block">
            <button
              type="button"
              className="collapsible-head"
              onClick={() => (isQA ? setAgentOutputExpanded((value) => !value) : setActivityExpanded((value) => !value))}
            >
              <span>{isQA ? "AI Agent Output" : "AI Agent Activity"}</span>
              <span className={(isQA ? agentOutputExpanded : activityExpanded) ? "expanded" : ""}>
                <IconChevron />
              </span>
            </button>
            {(isQA ? agentOutputExpanded : activityExpanded) ? (
              <pre>
[log] Agent reviewed baseline implementation.
[log] Suggested cleanup for approval state transitions.
[log] Pending push items detected and queued for reviewer action.
              </pre>
            ) : null}
          </section>

          <section className="comment-thread-wrap">
            <h3>Comments & Review Thread</h3>
            <ul>
              {selectedTaskComments.map((comment) => {
                const author = accountByUsername[comment.authorUsername];
                if (!author) {
                  return null;
                }

                return (
                  <li
                    key={comment.id}
                    className={`${comment.qaReview ? "qa-review" : ""} ${comment.pendingPush ? "pending-push" : ""}`}
                  >
                    <div className="comment-head">
                      <div className="comment-author">
                        <img src={author.avatarUrl} alt={author.displayName} />
                        <strong>{author.displayName}</strong>
                        <span className="role-chip">{roleLabel(comment.role)}</span>
                        {comment.qaReview ? <span className="qa-review-tag">QA Review</span> : null}
                        {comment.pendingPush ? <span className="pending-tag">Pending Push</span> : null}
                      </div>
                      <time>{comment.timestamp}</time>
                    </div>
                    <p>{comment.text}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          <footer className="task-action-bar">
            {isQA ? (
              <>
                {qaPushStateByTask[selectedTask?.id ?? ""] === "rejected" ? (
                  <p className="rejection-note">Rejected: {qaRejectionNoteByTask[selectedTask?.id ?? ""]}</p>
                ) : null}
                <textarea
                  value={qaDraftText}
                  onChange={(event) => setQaDraftText(event.target.value)}
                  placeholder="Write your review comment..."
                />
                <div className="action-row-buttons">
                  <button type="button" className="ghost-btn">
                    Save Draft
                  </button>
                  {qaPushStateByTask[selectedTask?.id ?? ""] === "awaiting" ? (
                    <button type="button" className="disabled-push-btn" disabled>
                      <IconClock /> Awaiting Approval...
                    </button>
                  ) : qaPushStateByTask[selectedTask?.id ?? ""] === "rejected" ? (
                    <button
                      type="button"
                      className="reject-resubmit-btn"
                      onClick={() =>
                        setQaPushStateByTask((current) => ({
                          ...current,
                          [selectedTask?.id ?? ""]: "awaiting",
                        }))
                      }
                    >
                      Rejected - Revise & Resubmit
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="amber-btn"
                      onClick={() =>
                        setQaPushStateByTask((current) => ({
                          ...current,
                          [selectedTask?.id ?? ""]: "awaiting",
                        }))
                      }
                    >
                      Push for Approval
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={commentInput}
                  onChange={(event) => setCommentInput(event.target.value)}
                  placeholder="Add a comment..."
                />
                <div className="action-row-buttons">
                  <button type="button" className="green-ghost-btn">
                    Mark Complete
                  </button>
                  <button type="button" className="purple-btn">
                    Push to Agent
                  </button>
                </div>
              </>
            )}
          </footer>
        </section>
      </section>
    );
  };

  if (!tokenReady) {
    return (
      <main className="dashboard-loading-wrap">
        <section className="dashboard-loading-panel">
          <h1>Redirecting...</h1>
          <p className="dashboard-loading-info">Checking authentication state.</p>
        </section>
      </main>
    );
  }

  if (activeAccount.role === "support") {
    return (
      <main className="dashboard-shell">
        <DashboardSidebar activeRole={activeAccount.role} />
        <section className="dashboard-main">
          <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Tasks" />
          <div className="dashboard-scroll-area">
            <section className="dashboard-card">
              <div className="card-head">
                <h2>Access</h2>
              </div>
              <p className="team-subtitle">Support role does not have Tasks workspace access in this phase.</p>
              <p className="team-subtitle">
                Continue in <Link href="/support">Support workspace</Link>.
              </p>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <DashboardSidebar activeRole={activeAccount.role} />
      <section className="dashboard-main">
        <DashboardTopBar activeAccount={activeAccount} notifications={roleNotifications} title="Tasks" />

        <div className="dashboard-scroll-area">
          <section className="tasks-page-head">
            <h2>
              <IconBoard />
              Workspace
            </h2>
            <p>
              Role View: <strong>{roleLabel(activeAccount.role)}</strong>
            </p>
          </section>

          {activeAccount.role === "admin" ? renderAdminView() : renderDeveloperOrQaView()}
        </div>
      </section>
    </main>
  );
}
