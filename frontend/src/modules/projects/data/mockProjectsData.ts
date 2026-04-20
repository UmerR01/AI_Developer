import type { ProjectRecord } from "../types";

export const PROJECTS_DATA: ProjectRecord[] = [
  {
    id: "ai-agent-workspace",
    name: "AI Agent Workspace",
    owner: "Ibrahim",
    description: "Core platform workspace for role-aware agent collaboration flows.",
    state: "In Review",
    updatedAt: "2026-04-20 10:20",
    tasks: [
      { id: "task-1", title: "Validate dashboard handoff", assignee: "Zahid", status: "in_progress" },
      { id: "task-2", title: "Patch role-aware controls", assignee: "Ismail", status: "todo" },
    ],
    activity: [
      { id: "a1", text: "QA comments were submitted for review", time: "18m ago" },
      { id: "a2", text: "Agent run completed for sprint 4", time: "42m ago" },
      { id: "a3", text: "Deployment checklist updated", time: "1h ago" },
    ],
    artifacts: [
      { id: "ar1", name: "requirements-v4.md", type: "spec" },
      { id: "ar2", name: "dashboard.tsx", type: "code" },
      { id: "ar3", name: "qa-checklist.md", type: "test" },
    ],
    commentSummary: { open: 5, approved: 2, pushed: 1 },
    deployments: [
      { id: "d1", version: "v0.6.0", status: "success", deployedAt: "2026-04-18 15:14" },
    ],
  },
  {
    id: "projects-module-foundation",
    name: "Projects Module Foundation",
    owner: "Ismail",
    description: "Unified Projects workspace with list, view tabs, and action flow.",
    state: "Draft",
    updatedAt: "2026-04-20 09:50",
    tasks: [
      { id: "task-3", title: "Implement overview tab", assignee: "Ismail", status: "in_progress" },
      { id: "task-4", title: "Prepare deployment mock", assignee: "Faizan", status: "todo" },
    ],
    activity: [
      { id: "a4", text: "Project draft initialized", time: "30m ago" },
      { id: "a5", text: "Task board seeded", time: "1h ago" },
    ],
    artifacts: [
      { id: "ar4", name: "projects-plan.md", type: "spec" },
      { id: "ar5", name: "project-shell.tsx", type: "code" },
    ],
    commentSummary: { open: 0, approved: 0, pushed: 0 },
    deployments: [],
  },
  {
    id: "support-workflow-revamp",
    name: "Support Workflow Revamp",
    owner: "AI_dev",
    description: "Refine support ticket triage and escalation visibility.",
    state: "In Progress",
    updatedAt: "2026-04-20 08:15",
    tasks: [
      { id: "task-5", title: "Tag escalation priorities", assignee: "AI_dev", status: "in_progress" },
      { id: "task-6", title: "Audit ticket states", assignee: "Ibrahim", status: "todo" },
    ],
    activity: [
      { id: "a6", text: "Support queue synced", time: "58m ago" },
      { id: "a7", text: "Escalation matrix reviewed", time: "2h ago" },
    ],
    artifacts: [
      { id: "ar6", name: "ticket-routing.md", type: "spec" },
      { id: "ar7", name: "support-state.json", type: "design" },
    ],
    commentSummary: { open: 2, approved: 1, pushed: 0 },
    deployments: [],
  },
];
