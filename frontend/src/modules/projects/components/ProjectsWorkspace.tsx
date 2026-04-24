"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";

import {
  archiveProject,
  createProject,
  deleteProjectFile,
  fetchProjectById,
  fetchProjects,
  restoreProject,
  updateProject,
  uploadProjectFile,
} from "../api";
import type { ProjectRecord, ProjectState } from "../types";
import { DASHBOARD_DATA } from "../../dashboard/data/mockDashboardData";
import type { Account } from "../../dashboard/types";

interface ProjectsWorkspaceProps {
  selectedProjectId?: string;
}

type ProjectTab = "overview" | "files" | "tasks" | "timeline" | "logs";
type TaskColumn = "todo" | "in_progress" | "in_review" | "done";
type TaskPriority = "high" | "medium" | "low";
type TaskType = "research" | "frontend" | "backend" | "audit" | "db";

interface ProjectTaskCard {
  id: string;
  name: string;
  description: string;
  priority: TaskPriority;
  type: TaskType;
  status: TaskColumn;
  assigneeIds: string[];
  createdAt: string;
  commentsCount: number;
  mentionsCount: number;
}

interface ProjectFileRow {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedByName: string;
}

interface ProjectMeta {
  createdAt: string;
  startDate: string;
  memberAccountIds: string[];
}

interface TimelineEvent {
  id: string;
  time: string;
  text: string;
}

interface EnrichedProject extends ProjectRecord {
  normalizedState: "Draft" | "In Progress" | "Completed";
  createdAt: string;
  startDate: string;
  memberAccountIds: string[];
  logoText: string;
  modifiedTimestamp: number;
  recentScore: number;
}

type ProjectFilter = "all" | "active" | "archived";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function usagePercent(used: number, total: number): number {
  if (!total) {
    return 0;
  }
  return Math.min(100, Math.max(0, (used / total) * 100));
}

function usageTone(percent: number): "good" | "warn" | "danger" {
  if (percent > 90) {
    return "danger";
  }
  if (percent >= 70) {
    return "warn";
  }
  return "good";
}

const PROJECT_TABS: ProjectTab[] = ["overview", "files", "tasks", "timeline", "logs"];
const TASK_COLUMNS: TaskColumn[] = ["todo", "in_progress", "in_review", "done"];
const TASK_COLUMN_LABELS: Record<TaskColumn, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Progress",
  done: "Done",
};

const TAB_LABELS: Record<ProjectTab, string> = {
  overview: "Overview",
  files: "Files",
  tasks: "Tasks",
  timeline: "Timeline",
  logs: "Logs",
};

const COLUMN_VISIBLE_DEFAULT: Record<TaskColumn, number> = {
  todo: 4,
  in_progress: 4,
  in_review: 4,
  done: 4,
};

const VISIT_STORAGE_KEY = "projects:lastVisitedMap";

const DEFAULT_MEMBER_IDS = ["acc-ibrahim", "acc-ismail", "acc-zahid", "acc-faizan"];

const PROJECT_META_BY_ID: Record<string, ProjectMeta> = {
  "ai-agent-workspace": {
    createdAt: "2026-03-24",
    startDate: "2026-03-28",
    memberAccountIds: ["acc-ibrahim", "acc-ismail", "acc-zahid", "acc-faizan"],
  },
  "projects-module-foundation": {
    createdAt: "2026-04-02",
    startDate: "2026-04-05",
    memberAccountIds: ["acc-ibrahim", "acc-ismail", "acc-faizan"],
  },
  "support-workflow-revamp": {
    createdAt: "2026-03-18",
    startDate: "2026-03-21",
    memberAccountIds: ["acc-ai-dev", "acc-ibrahim", "acc-zahid", "acc-faizan"],
  },
  "testing-and-qc-suite": {
    createdAt: "2026-03-30",
    startDate: "2026-04-01",
    memberAccountIds: ["acc-zahid", "acc-faizan", "acc-ismail", "acc-ibrahim"],
  },
};

function isProjectTab(value: string | null): value is ProjectTab {
  return value === "overview" || value === "files" || value === "tasks" || value === "timeline" || value === "logs";
}

function normalizeState(state: ProjectState): EnrichedProject["normalizedState"] {
  if (state === "Draft") {
    return "Draft";
  }
  if (state === "Live") {
    return "Completed";
  }
  if (state === "In Review" || state === "Pending Push" || state === "Revising") {
    return "In Progress";
  }
  return "In Progress";
}

function stateChipClassName(state: EnrichedProject["normalizedState"]): string {
  if (state === "Draft") {
    return "state-draft";
  }
  if (state === "Completed") {
    return "state-completed";
  }
  if (state === "In Progress") {
    return "state-review";
  }
  return "state-progress";
}

function parseDateToTimestamp(value: string): number {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateLabel(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "PR";
  }
  const first = words[0][0] ?? "P";
  const second = words[1]?.[0] ?? words[0][1] ?? "R";
  return `${first}${second}`.toUpperCase();
}

function mapTaskStatus(taskStatus: "todo" | "in_progress" | "done", index: number): TaskColumn {
  if (taskStatus === "done") {
    return "done";
  }
  if (taskStatus === "in_progress") {
    return index % 2 === 0 ? "in_progress" : "in_review";
  }
  return "todo";
}

function getMetadata(project: ProjectRecord): ProjectMeta {
  return (
    PROJECT_META_BY_ID[project.id] ?? {
      createdAt: project.updatedAt.split(" ")[0] ?? "2026-04-01",
      startDate: project.updatedAt.split(" ")[0] ?? "2026-04-01",
      memberAccountIds: DEFAULT_MEMBER_IDS,
    }
  );
}

function buildTaskCards(project: ProjectRecord, memberIds: string[]): ProjectTaskCard[] {
  const priorityCycle: TaskPriority[] = ["high", "medium", "low"];
  const typeCycle: TaskType[] = ["research", "frontend", "backend", "audit", "db"];

  const base = project.tasks.map((task, index) => ({
    id: `task-${project.id}-${task.id}`,
    name: task.title,
    description: `${task.title} and align output quality with project delivery standards.`,
    priority: priorityCycle[index % priorityCycle.length],
    type: typeCycle[index % typeCycle.length],
    status: mapTaskStatus(task.status, index),
    assigneeIds: [memberIds[index % memberIds.length] ?? memberIds[0] ?? DEFAULT_MEMBER_IDS[0]],
    createdAt: project.updatedAt,
    commentsCount: index + 1,
    mentionsCount: index % 3,
  }));

  const generated: ProjectTaskCard[] = Array.from({ length: 10 }).map((_, index) => {
    const statusPool: TaskColumn[] = ["todo", "todo", "in_progress", "in_review", "done"];
    const status = statusPool[index % statusPool.length];
    const firstMember = memberIds[index % memberIds.length] ?? memberIds[0] ?? DEFAULT_MEMBER_IDS[0];
    const secondMember = memberIds[(index + 1) % memberIds.length] ?? firstMember;

    return {
      id: `generated-${project.id}-${index + 1}`,
      name: `${project.name} Task ${index + 1}`,
      description: "Refine the implementation slice and attach validation notes before handoff.",
      priority: priorityCycle[(index + 1) % priorityCycle.length],
      type: typeCycle[(index + 2) % typeCycle.length],
      status,
      assigneeIds: [firstMember, secondMember],
      createdAt: project.updatedAt,
      commentsCount: (index % 5) + 1,
      mentionsCount: index % 2,
    };
  });

  return [...base, ...generated];
}

function buildFileRows(project: ProjectRecord): ProjectFileRow[] {
  const relationalRows = project.files.map((file) => ({
    id: file.id,
    name: file.fileName,
    type: file.fileType,
    size: file.fileSize,
    uploadedAt: file.uploadedAt,
    uploadedByName: file.uploadedByName,
  }));

  if (relationalRows.length) {
    return relationalRows;
  }

  const artifactRows = project.artifacts.map((artifact) => ({
    id: `artifact-${project.id}-${artifact.id}`,
    name: artifact.name,
    type: artifact.type,
    size: 0,
    uploadedAt: formatDateLabel(project.updatedAt),
    uploadedByName: project.owner,
  }));

  const defaults: ProjectFileRow[] = [
    {
      id: `default-spec-${project.id}`,
      name: `${project.id}-specification.md`,
      type: "md",
      size: 0,
      uploadedAt: formatDateLabel(project.updatedAt),
      uploadedByName: project.owner,
    },
    {
      id: `default-log-${project.id}`,
      name: `${project.id}-handoff-log.txt`,
      type: "txt",
      size: 0,
      uploadedAt: formatDateLabel(project.updatedAt),
      uploadedByName: project.owner,
    },
  ];

  return [...artifactRows, ...defaults];
}

function buildTimeline(project: EnrichedProject, taskCards: ProjectTaskCard[]): TimelineEvent[] {
  const activityEvents = project.activity.map((entry) => ({
    id: `activity-${project.id}-${entry.id}`,
    time: entry.time,
    text: entry.text,
  }));

  const taskEvents = taskCards.slice(0, 5).map((task) => ({
    id: `task-event-${task.id}`,
    time: formatDateLabel(task.createdAt),
    text: `Task added: ${task.name}`,
  }));

  const deploymentEvents = project.deployments.map((deployment) => ({
    id: `deployment-${deployment.id}`,
    time: deployment.deployedAt,
    text: `Deployment ${deployment.version} marked as ${deployment.status}`,
  }));

  const commentEvent: TimelineEvent = {
    id: `comments-${project.id}`,
    time: formatDateLabel(project.updatedAt),
    text: `${project.commentSummary.open} open comments and ${project.commentSummary.approved} approved notes in review flow.`,
  };

  return [commentEvent, ...activityEvents, ...taskEvents, ...deploymentEvents];
}

function mapLegacyViewToTab(legacyView: string | null): ProjectTab {
  if (legacyView === "review") {
    return "tasks";
  }
  if (legacyView === "deployments") {
    return "logs";
  }
  return "overview";
}

function memberRoleLabel(role: Account["role"]): string {
  if (role === "qa") {
    return "QA";
  }
  if (role === "support") {
    return "Support";
  }
  if (role === "developer") {
    return "Developer";
  }
  return "Admin";
}

function ProjectAvatarStack({ members, maxVisible = 4 }: { members: Account[]; maxVisible?: number }) {
  if (!members.length) {
    return <span className="project-avatar-empty">No members</span>;
  }

  const visibleMembers = members.slice(0, maxVisible);
  const hiddenCount = members.length - visibleMembers.length;

  return (
    <div className="project-avatar-stack" aria-label="project members">
      {visibleMembers.map((member) => (
        <img
          key={member.id}
          className="project-avatar-circle"
          src={member.avatarUrl}
          alt={member.displayName}
          title={`${member.displayName} (${memberRoleLabel(member.role)})`}
        />
      ))}
      {hiddenCount > 0 ? <span className="project-avatar-overflow">+{hiddenCount}</span> : null}
    </div>
  );
}

export function ProjectsWorkspace({ selectedProjectId }: ProjectsWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createAvatarFile, setCreateAvatarFile] = useState<File | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("Draft");

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [fileDeleteConfirmId, setFileDeleteConfirmId] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState("All");

  const [visibleAllCount, setVisibleAllCount] = useState(5);
  const [visitMap, setVisitMap] = useState<Record<string, number>>({});

  const [teamPopupOpen, setTeamPopupOpen] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberEmail, setAddMemberEmail] = useState("");
  const [addMemberRole, setAddMemberRole] = useState("developer");
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [memberRemoveTarget, setMemberRemoveTarget] = useState<Account | null>(null);

  const [taskCards, setTaskCards] = useState<ProjectTaskCard[]>([]);
  const [columnVisible, setColumnVisible] = useState<Record<TaskColumn, number>>(COLUMN_VISIBLE_DEFAULT);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const accountById = useMemo(() => {
    return DASHBOARD_DATA.accounts.reduce<Record<string, Account>>((accumulator, account) => {
      accumulator[account.id] = account;
      return accumulator;
    }, {});
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(VISIT_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Record<string, number>;
      setVisitMap(parsed);
    } catch {
      setVisitMap({});
    }
  }, []);

  const markVisited = (projectId: string) => {
    const now = Date.now();
    setVisitMap((current) => {
      const next = { ...current, [projectId]: now };
      window.localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadProjects = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const loadedProjects = await fetchProjects();
      setProjects(loadedProjects);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load projects right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    setVisibleAllCount(5);
  }, [projects.length]);

  useEffect(() => {
    const fetchMissingSelected = async () => {
      if (!selectedProjectId) {
        return;
      }

      if (projects.some((project) => project.id === selectedProjectId)) {
        return;
      }

      try {
        const loaded = await fetchProjectById(selectedProjectId);
        if (!loaded) {
          return;
        }
        setProjects((current) => {
          if (current.some((project) => project.id === loaded.id)) {
            return current;
          }
          return [loaded, ...current];
        });
      } catch {
        // Keep page resilient when detail fetch misses.
      }
    };

    void fetchMissingSelected();
  }, [projects, selectedProjectId]);

  const enrichedProjects = useMemo<EnrichedProject[]>(() => {
    return projects.map((project) => {
      const metadata = getMetadata(project);
      const modifiedTimestamp = parseDateToTimestamp(project.updatedAt);
      const visitTimestamp = visitMap[project.id] ?? 0;

      return {
        ...project,
        normalizedState: normalizeState(project.state),
        createdAt: metadata.createdAt,
        startDate: metadata.startDate,
        memberAccountIds: metadata.memberAccountIds,
        logoText: initials(project.name),
        modifiedTimestamp,
        recentScore: Math.max(modifiedTimestamp, visitTimestamp),
      };
    });
  }, [projects, visitMap]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }
    return enrichedProjects.find((project) => project.id === selectedProjectId) ?? null;
  }, [enrichedProjects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    const memberIds = selectedProject.memberAccountIds.length ? selectedProject.memberAccountIds : DEFAULT_MEMBER_IDS;
    setTaskCards(buildTaskCards(selectedProject, memberIds));
    setColumnVisible(COLUMN_VISIBLE_DEFAULT);
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) {
      setTeamMemberIds([]);
      return;
    }
    const memberIds = selectedProject.memberAccountIds.length ? selectedProject.memberAccountIds : DEFAULT_MEMBER_IDS;
    setTeamMemberIds(memberIds);
  }, [selectedProject]);

  const visibleProjectSet = useMemo(() => {
    if (projectFilter === "active") {
      return enrichedProjects.filter((project) => !project.isDeleted);
    }
    if (projectFilter === "archived") {
      return enrichedProjects.filter((project) => project.isDeleted);
    }
    return enrichedProjects;
  }, [enrichedProjects, projectFilter]);

  const recentProjects = useMemo(() => {
    return [...visibleProjectSet].sort((first, second) => second.recentScore - first.recentScore).slice(0, 3);
  }, [visibleProjectSet]);

  const sortedProjects = useMemo(() => {
    return [...visibleProjectSet].sort((first, second) => second.modifiedTimestamp - first.modifiedTimestamp);
  }, [visibleProjectSet]);

  const visibleProjects = useMemo(() => {
    return sortedProjects.slice(0, visibleAllCount);
  }, [sortedProjects, visibleAllCount]);

  const remainingProjectCount = Math.max(sortedProjects.length - visibleAllCount, 0);

  const kpiMetrics = useMemo(() => {
    const total = enrichedProjects.length;
    const draft = enrichedProjects.filter((project) => project.normalizedState === "Draft").length;
    const completed = enrichedProjects.filter((project) => project.normalizedState === "Completed").length;
    const inReview = enrichedProjects.filter((project) => project.normalizedState === "In Progress").length;

    return [
      { id: "total", label: "Total Projects", value: total, icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg> },
      { id: "draft", label: "Draft Projects", value: draft, icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-5.5"/><polyline points="14 2 14 8 20 8"/><path d="M10.42 12.61a2.1 2.1 0 1 1 2.97 2.97L7.95 21 4 22l.99-3.95 5.43-5.44Z"/></svg> },
      { id: "completed", label: "Completed Projects", value: completed, icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> },
      { id: "review", label: "In Progress Projects", value: inReview, icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> },
    ];
  }, [enrichedProjects]);

  const activeTab: ProjectTab = useMemo(() => {
    const tabParam = searchParams.get("tab");
    if (isProjectTab(tabParam)) {
      return tabParam;
    }

    if (selectedProjectId) {
      return mapLegacyViewToTab(searchParams.get("view"));
    }

    return "overview";
  }, [searchParams, selectedProjectId]);

  const setTab = (tab: ProjectTab) => {
    if (!selectedProject) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("view");
    router.push(`/projects/${selectedProject.id}?${params.toString()}`);
  };

  const openProjectDetails = (project: EnrichedProject) => {
    markVisited(project.id);
    router.push(`/projects/${project.id}?tab=overview`);
  };

  const selectedMembers = useMemo(() => {
    if (!selectedProject || !teamMemberIds.length) {
      return [] as Account[];
    }

    return teamMemberIds.map((memberId) => accountById[memberId]).filter(Boolean);
  }, [accountById, selectedProject, teamMemberIds]);

  const availableAdminMembers = useMemo(() => {
    const searchText = teamMemberSearch.trim().toLowerCase();
    return DASHBOARD_DATA.accounts
      .filter((account) => (account.role === "admin" || account.role === "developer" || account.role === "qa") && !teamMemberIds.includes(account.id))
      .filter((account) => {
        if (!searchText) {
          return true;
        }
        return (
          account.displayName.toLowerCase().includes(searchText) ||
          account.email.toLowerCase().includes(searchText) ||
          account.username.toLowerCase().includes(searchText)
        );
      });
  }, [teamMemberIds, teamMemberSearch]);

  const selectedMemberTaskCounts = useMemo(() => {
    return taskCards.reduce<Record<string, number>>((accumulator, task) => {
      task.assigneeIds.forEach((memberId) => {
        accumulator[memberId] = (accumulator[memberId] ?? 0) + 1;
      });
      return accumulator;
    }, {});
  }, [taskCards]);

  const addMemberToTeam = (memberId: string) => {
    setTeamMemberIds((current) => (current.includes(memberId) ? current : [...current, memberId]));
    setShowAddMemberForm(false);
    setTeamMemberSearch("");
  };

  const handleInviteMember = () => {
    if (!addMemberEmail.trim()) {
      return;
    }
    setShowAddMemberForm(false);
    setAddMemberName("");
    setAddMemberEmail("");
    setAddMemberRole("developer");
    setTeamMemberSearch("");
  };

  const confirmRemoveMember = () => {
    if (!memberRemoveTarget) {
      return;
    }
    setTeamMemberIds((current) => current.filter((memberId) => memberId !== memberRemoveTarget.id));
    setMemberRemoveTarget(null);
  };

  const tasksByColumn = useMemo(() => {
    return TASK_COLUMNS.reduce<Record<TaskColumn, ProjectTaskCard[]>>((accumulator, column) => {
      accumulator[column] = taskCards.filter((task) => task.status === column);
      return accumulator;
    }, { todo: [], in_progress: [], in_review: [], done: [] });
  }, [taskCards]);

  const timeline = useMemo(() => {
    if (!selectedProject) {
      return [] as TimelineEvent[];
    }
    return buildTimeline(selectedProject, taskCards);
  }, [selectedProject, taskCards]);

  const fileRows = useMemo(() => {
    if (!selectedProject) {
      return [] as ProjectFileRow[];
    }
    return buildFileRows(selectedProject);
  }, [selectedProject]);

  const handleTaskDrop = (targetColumn: TaskColumn) => {
    if (!dragTaskId) {
      return;
    }

    setTaskCards((current) => {
      const currentTask = current.find((task) => task.id === dragTaskId);
      if (!currentTask || currentTask.status === targetColumn) {
        return current;
      }

      return current.map((task) => (task.id === dragTaskId ? { ...task, status: targetColumn } : task));
    });

    setDragTaskId(null);
  };

  const handleAddTask = (column: TaskColumn) => {
    if (!selectedProject) {
      return;
    }

    const defaultMemberId = selectedMembers[0]?.id ?? DEFAULT_MEMBER_IDS[0];

    setTaskCards((current) => [
      {
        id: `manual-${selectedProject.id}-${Date.now()}`,
        name: `New ${TASK_COLUMN_LABELS[column]} Task`,
        description: "Fresh task card added from column action. Define exact scope before assignment.",
        priority: "medium",
        type: "frontend",
        status: column,
        assigneeIds: [defaultMemberId],
        createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        commentsCount: 0,
        mentionsCount: 0,
      },
      ...current,
    ]);
  };

  const applyProjectPatch = (nextProject: ProjectRecord | null | undefined) => {
    if (!nextProject) {
      return;
    }
    setProjects((current) => {
      const exists = current.some((project) => project.id === nextProject.id);
      if (!exists) {
        return [nextProject, ...current];
      }
      return current.map((project) => (project.id === nextProject.id ? nextProject : project));
    });
  };

  const handleCreateProject = async () => {
    if (!createName.trim() || !createDescription.trim()) {
      setErrorMessage("Project name and description are required.");
      return;
    }

    setBusyAction("create-project");
    setErrorMessage(null);

    try {
      const created = await createProject(createName.trim(), createDescription.trim());
      if (!created.success || !created.project) {
        setErrorMessage(created.message || "Unable to create project.");
        return;
      }

      applyProjectPatch(created.project);
      setCreateName("");
      setCreateDescription("");
      setCreateAvatarFile(null);
      setCreateModalOpen(false);
      router.push(`/projects/${created.project.id}?tab=overview`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    setBusyAction(`archive-${projectId}`);
    setErrorMessage(null);
    try {
      const result = await archiveProject(projectId);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      applyProjectPatch(result.project);
      setShowArchiveConfirm(false);
      setHeaderMenuOpen(false);
      if (selectedProjectId === projectId) {
        router.push("/projects");
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    setBusyAction(`restore-${projectId}`);
    setErrorMessage(null);
    try {
      const result = await restoreProject(projectId);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      applyProjectPatch(result.project);
    } finally {
      setBusyAction(null);
    }
  };

  const openEditModal = () => {
    if (!selectedProject) {
      return;
    }
    setEditName(selectedProject.name);
    setEditDescription(selectedProject.description);
    setEditStatus(selectedProject.state);
    setEditModalOpen(true);
    setHeaderMenuOpen(false);
  };

  const handleSaveProjectEdit = async () => {
    if (!selectedProject) {
      return;
    }

    setBusyAction(`edit-${selectedProject.id}`);
    setErrorMessage(null);
    try {
      const result = await updateProject(selectedProject.id, {
        name: editName,
        description: editDescription,
        status: editStatus,
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      applyProjectPatch(result.project);
      setEditModalOpen(false);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject || !selectedProject.ownerId) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const quota = selectedProject.storage?.totalQuota ?? 0;
    const used = selectedProject.usedStorage;
    const remaining = Math.max(quota - used, 0);
    if (quota > 0 && file.size > remaining) {
      setErrorMessage(
        `This file (${formatBytes(file.size)}) exceeds your remaining storage (${formatBytes(remaining)}).`,
      );
      event.target.value = "";
      return;
    }

    setBusyAction(`upload-${selectedProject.id}`);
    setErrorMessage(null);
    try {
      const extension = file.name.includes(".") ? file.name.split(".").pop() ?? "file" : "file";
      const result = await uploadProjectFile({
        projectId: selectedProject.id,
        uploadedById: selectedProject.ownerId,
        fileName: file.name,
        filePath: `${selectedProject.folderPath}/${file.name}`,
        fileSize: file.size,
        fileType: extension.toLowerCase(),
      });
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      applyProjectPatch(result.project);
    } finally {
      setBusyAction(null);
      event.target.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    setBusyAction(`delete-file-${fileId}`);
    setErrorMessage(null);
    try {
      const result = await deleteProjectFile(fileId);
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }
      applyProjectPatch(result.project);
      setFileDeleteConfirmId(null);
    } finally {
      setBusyAction(null);
    }
  };

  const renderMainPage = () => {
    return (
      <section className="projects-refined-wrap">
        <section className="projects-kpi-grid">
          {kpiMetrics.map((metric) => (
            <article
              key={metric.id}
              className={`projects-kpi-card ${
                metric.id === "total"
                  ? "kpi-open"
                  : metric.id === "draft"
                    ? "kpi-review"
                    : metric.id === "review"
                      ? "kpi-prog"
                      : "kpi-res"
              }`}
            >
              <span className="projects-kpi-label">{metric.label}</span>
              <strong className="projects-kpi-num">{String(metric.value).padStart(2, "0")}</strong>
              <span className="projects-kpi-icon" aria-hidden>
                {metric.icon}
              </span>
            </article>
          ))}
        </section>

        <section className="projects-section-block">
          <div className="projects-section-head">
            <h2>Recent Projects</h2>
            <span>Most recently opened or updated workspaces</span>
          </div>

          <div className="projects-card-grid recent-grid">
            {recentProjects.map((project) => {
              const members = project.memberAccountIds.map((memberId) => accountById[memberId]).filter(Boolean);
              const totalQuota = project.storage?.totalQuota ?? 1024 * 1024 * 1024;
              const percent = usagePercent(project.usedStorage, totalQuota);
              const tone = usageTone(percent);

              return (
                <article
                  key={project.id}
                  className={`project-card ${project.isDeleted ? "archived" : ""}`}
                  onClick={() => {
                    if (project.isDeleted) {
                      return;
                    }
                    openProjectDetails(project);
                  }}
                >
                  <div className="project-card-top">
                    <span className="project-logo">{project.logoText}</span>
                    <div>
                      <h3>{project.name}</h3>
                      <span className={`project-status-chip ${stateChipClassName(project.normalizedState)}`}>{project.normalizedState}</span>
                      {project.isDeleted ? <span className="project-archived-chip">Archived</span> : null}
                    </div>
                  </div>

                  <ProjectAvatarStack members={members} maxVisible={4} />

                  <div className="project-card-meta">
                    <span>Created {formatDateLabel(project.createdAt)}</span>
                    <span>Modified {formatDateLabel(project.updatedAt)}</span>
                  </div>

                  <div className="project-storage-row">
                    <span>{`Storage: ${formatBytes(project.usedStorage)} / ${formatBytes(totalQuota)}`}</span>
                    <div className={`project-storage-bar ${tone}`}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="projects-section-block">
          <div className="projects-section-head">
            <h2>All Projects</h2>
            <span>Workspace inventory and status overview</span>
          </div>

          <div className="projects-list-controls">
            <div className="projects-filter-pills" role="tablist" aria-label="Project filter">
              {(["all", "active", "archived"] as ProjectFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={projectFilter === value ? "active" : ""}
                  onClick={() => setProjectFilter(value)}
                >
                  {value === "all" ? "All" : value === "active" ? "Active" : "Archived"}
                </button>
              ))}
            </div>

            <button type="button" className="action-btn-primary" onClick={() => setCreateModalOpen(true)}>
              + New Project
            </button>
          </div>

          <div className="projects-card-grid all-grid">
            {visibleProjects.map((project) => {
              const members = project.memberAccountIds.map((memberId) => accountById[memberId]).filter(Boolean);
              const totalQuota = project.storage?.totalQuota ?? 1024 * 1024 * 1024;
              const percent = usagePercent(project.usedStorage, totalQuota);
              const tone = usageTone(percent);

              return (
                <article
                  key={project.id}
                  className={`project-card ${project.isDeleted ? "archived" : ""}`}
                  onClick={() => {
                    if (project.isDeleted) {
                      return;
                    }
                    openProjectDetails(project);
                  }}
                >
                  <div className="project-card-top">
                    <span className="project-logo">{project.logoText}</span>
                    <div>
                      <h3>{project.name}</h3>
                      <span className={`project-status-chip ${stateChipClassName(project.normalizedState)}`}>{project.normalizedState}</span>
                      {project.isDeleted ? <span className="project-archived-chip">Archived</span> : null}
                    </div>
                  </div>

                  <ProjectAvatarStack members={members} maxVisible={4} />

                  <div className="project-card-meta">
                    <span>Created {formatDateLabel(project.createdAt)}</span>
                    <span>Modified {formatDateLabel(project.updatedAt)}</span>
                  </div>

                  <div className="project-storage-row">
                    <span>{`Storage: ${formatBytes(project.usedStorage)} / ${formatBytes(totalQuota)}`}</span>
                    <div className={`project-storage-bar ${tone}`}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  {project.isDeleted ? (
                    <button
                      type="button"
                      className="project-restore-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRestoreProject(project.id);
                      }}
                      disabled={busyAction === `restore-${project.id}`}
                    >
                      Restore
                    </button>
                  ) : null}
                </article>
              );
            })}

            {remainingProjectCount > 0 ? (
              <button type="button" className="project-load-more-card" onClick={() => setVisibleAllCount((current) => current + 5)}>
                <span>Load More</span>
                <strong>+{remainingProjectCount}</strong>
              </button>
            ) : null}
          </div>
        </section>

        {createModalOpen ? (
          <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create project">
            <section className="projects-modal">
              <h3>Create Project</h3>
              <label>
                Project Name
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Project name" />
              </label>
              <label>
                Description
                <textarea
                  rows={4}
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="Describe this project"
                />
              </label>
              <label>
                Project Avatar (optional)
                <input type="file" accept="image/*" onChange={(event) => setCreateAvatarFile(event.target.files?.[0] ?? null)} />
              </label>
              {createAvatarFile ? <p className="projects-modal-subtitle">Selected: {createAvatarFile.name}</p> : null}
              {errorMessage ? <p className="projects-modal-error">{errorMessage}</p> : null}
              <div className="modal-actions">
                <button type="button" className="projects-secondary-btn" onClick={() => setCreateModalOpen(false)} disabled={busyAction === "create-project"}>
                  Cancel
                </button>
                <button type="button" className="projects-primary-btn" onClick={() => void handleCreateProject()} disabled={busyAction === "create-project"}>
                  {busyAction === "create-project" ? "Creating..." : "Create Project"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
  };

  const renderDetailsPage = () => {
    if (!selectedProject) {
      return (
        <section className="projects-empty-state">
          <h2>Project not found</h2>
          <p>This project may not exist or is outside your current scope.</p>
          <Link href="/projects">Return to Projects</Link>
        </section>
      );
    }

    return (
      <section className="project-details-wrap">
        <nav className="project-breadcrumb" aria-label="breadcrumb">
          <Link href="/projects">Projects</Link>
          <span>&gt;</span>
          <strong>{selectedProject.name}</strong>
        </nav>

        <header className="project-details-header">
          <div className="project-title-row">
            <span className="project-avatar-large">{selectedProject.logoText}</span>
            <div>
              <h1>{selectedProject.name}</h1>
              <button type="button" className="project-edit-btn" aria-label="Edit project" onClick={openEditModal}>
                Edit Project
              </button>
            </div>
          </div>

          <div className="project-header-actions">
            <button type="button" className="project-team-row" onClick={() => setTeamPopupOpen(true)}>
              <ProjectAvatarStack members={selectedMembers} maxVisible={5} />
              <span>{selectedMembers.length} team members</span>
            </button>

            <div className="project-header-menu-wrap">
              <button type="button" className="project-menu-trigger" onClick={() => setHeaderMenuOpen((current) => !current)}>
                •••
              </button>
              {headerMenuOpen ? (
                <div className="project-header-menu">
                  <button type="button" onClick={openEditModal}>
                    Edit Project
                  </button>
                  <button type="button" className="danger" onClick={() => setShowArchiveConfirm(true)}>
                    Archive Project
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {(() => {
          const totalQuota = selectedProject.storage?.totalQuota ?? 1024 * 1024 * 1024;
          const percent = usagePercent(selectedProject.usedStorage, totalQuota);
          const tone = usageTone(percent);
          return (
            <section className="project-storage-detail-row">
              <div>
                <strong>Project Storage</strong>
                <p>{`${formatBytes(selectedProject.usedStorage)} used of ${formatBytes(totalQuota)}`}</p>
              </div>
              <div className={`project-storage-bar ${tone}`}>
                <span style={{ width: `${percent}%` }} />
              </div>
              {percent > 90 ? (
                <span className="project-storage-warning" title="Storage almost full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6, verticalAlign: "-3px"}}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  Storage almost full
                </span>
              ) : null}
            </section>
          );
        })()}

        <div className="project-tabs-row" role="tablist" aria-label="Project tabs">
          {PROJECT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "active" : ""}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <section className="project-tab-surface overview-grid">
            <article className="overview-main-card">
              <h3>Description</h3>
              <p>{selectedProject.description}</p>
            </article>

            <article className="overview-meta-card">
              <h3>Metadata</h3>
              <dl>
                <div>
                  <dt>Start Date</dt>
                  <dd>{formatDateLabel(selectedProject.startDate)}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateLabel(selectedProject.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last Modified</dt>
                  <dd>{formatDateLabel(selectedProject.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedProject.normalizedState}</dd>
                </div>
                <div>
                  <dt>Team Size</dt>
                  <dd>{selectedMembers.length}</dd>
                </div>
              </dl>
            </article>
          </section>
        ) : null}

        {activeTab === "files" ? (
          <section className="project-tab-surface files-section">
            {(() => {
              const totalQuota = selectedProject.storage?.totalQuota ?? 1024 * 1024 * 1024;
              const percent = usagePercent(selectedProject.usedStorage, totalQuota);
              const tone = usageTone(percent);
              const remaining = Math.max(totalQuota - selectedProject.usedStorage, 0);
              const lowSpace = remaining <= totalQuota * 0.1;
              const storageFull = remaining <= 0;

              return (
                <div className="files-storage-banner">
                  <p>{`Storage Used: ${formatBytes(selectedProject.usedStorage)} / ${formatBytes(totalQuota)}`}</p>
                  <div className={`project-storage-bar ${tone}`}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  {lowSpace || storageFull ? (
                    <small>You are running low on storage. Contact your admin or upgrade your plan.</small>
                  ) : null}
                </div>
              );
            })()}

            <div className="files-head">
              <h3>Project Files</h3>
              <label className="action-btn-primary file-upload-label">
                Upload File
                <input
                  type="file"
                  onChange={handleUploadFile}
                  disabled={busyAction === `upload-${selectedProject.id}`}
                />
              </label>
            </div>

            <ul className="files-list">
              {fileRows.map((fileRow) => (
                <li key={fileRow.id}>
                  <div className="file-main-cell">
                    <span className="file-icon" aria-hidden>
                      {fileRow.type.toLowerCase() === 'pdf' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>}
                      {fileRow.type.toLowerCase() === 'py' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>}
                      {fileRow.type.toLowerCase() === 'txt' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>}
                      {!['pdf', 'py', 'txt'].includes(fileRow.type.toLowerCase()) && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>}
                    </span>
                    <strong className="file-name">{fileRow.name}</strong>
                    <span className="file-type-chip">{fileRow.type.toUpperCase()}</span>
                  </div>
                  <span className="file-size">{formatBytes(fileRow.size)}</span>
                  <span className="file-uploader-row">
                    <img src={selectedProject.ownerId ? accountById[selectedProject.ownerId]?.avatarUrl : ""} alt="" className="file-uploader-avatar" />
                    <span className="file-uploader">{fileRow.uploadedByName}</span>
                  </span>
                  <span className="file-date">{formatDateLabel(fileRow.uploadedAt)}</span>
                  {fileDeleteConfirmId === fileRow.id ? (
                    <div className="file-delete-confirm">
                      <span>Delete this file?</span>
                      <button type="button" onClick={() => void handleDeleteFile(fileRow.id)}>
                        Yes
                      </button>
                      <button type="button" onClick={() => setFileDeleteConfirmId(null)}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="action-btn-ghost" aria-label="Delete file" title="Delete this file?" onClick={() => setFileDeleteConfirmId(fileRow.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {activeTab === "tasks" ? (
          <section className="project-tab-surface tasks-board-wrap">
            <div className="tasks-board-grid">
              {TASK_COLUMNS.map((column) => {
                const columnTasks = tasksByColumn[column];
                const visibleCount = columnVisible[column];
                const visibleTasks = columnTasks.slice(0, visibleCount);
                const hasMore = columnTasks.length > visibleCount;

                return (
                  <article
                    key={column}
                    className="task-column"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleTaskDrop(column)}
                  >
                    <header className="task-column-head">
                      <strong>{TASK_COLUMN_LABELS[column]}</strong>
                      <span className="task-column-count">{columnTasks.length}</span>
                      <button type="button" className="task-column-add" onClick={() => handleAddTask(column)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
                    </header>

                    <div className="task-card-list">
                      {visibleTasks.map((task) => {
                        const taskMembers = task.assigneeIds.map((memberId) => accountById[memberId]).filter(Boolean);

                        return (
                          <article
                            key={task.id}
                            className={`task-card ${dragTaskId === task.id ? "dragging" : ""}`}
                            draggable
                            onDragStart={(event: DragEvent<HTMLElement>) => {
                              event.dataTransfer.effectAllowed = "move";
                              setDragTaskId(task.id);
                            }}
                            onDragEnd={() => setDragTaskId(null)}
                          >
                            <div className="task-card-chip-row">
                              <span className={`task-chip priority-${task.priority}`}>{task.priority}</span>
                              <span className={`task-chip type-${task.type}`}>{task.type}</span>
                            </div>

                            <h4>{task.name}</h4>
                            <p>{task.description}</p>

                            <div className="task-members-row">
                              <ProjectAvatarStack members={taskMembers} maxVisible={3} />
                              <button type="button" className="task-member-add" aria-label="Add assignee"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
                            </div>

                            <footer className="task-card-footer">
                              <span>{formatDateLabel(task.createdAt)}</span>
                              <span className="task-badge"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4, verticalAlign: "-2px"}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>{task.commentsCount}</span>
                              <span className="task-badge"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4, verticalAlign: "-2px"}}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4.5 8.4"/></svg>{task.mentionsCount}</span>
                            </footer>
                          </article>
                        );
                      })}
                    </div>

                    {hasMore ? (
                      <button
                        type="button"
                        className="task-load-more"
                        onClick={() =>
                          setColumnVisible((current) => ({
                            ...current,
                            [column]: current[column] + 4,
                          }))
                        }
                      >
                        Load More
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeTab === "timeline" ? (
          <section className="project-tab-surface timeline-wrap">
            <div className="timeline-head">
              <h3>Timeline</h3>
              <div className="projects-filter-pills" role="tablist">
                {["All", "File Uploaded", "File Deleted", "Member Assigned", "Member Removed", "Task Created", "Task Updated", "Comment Added", "AI Output", "Status Changed", "Project Created", "Project Updated"].map(filter => (
                  <button
                    key={filter}
                    type="button"
                    className={timelineFilter === filter ? "active" : ""}
                    onClick={() => setTimelineFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <ul className="timeline-list">
              {timeline.map((event) => {
                let icon = "⚙️";
                let nodeClass = "timeline-node node-gray";
                if (event.text.includes("File uploaded")) { icon = "📄"; nodeClass = "timeline-node node-green"; }
                else if (event.text.includes("File deleted")) { icon = "🗑"; nodeClass = "timeline-node node-red"; }
                else if (event.text.includes("assigned")) { icon = "👤"; nodeClass = "timeline-node node-blue"; }
                else if (event.text.includes("removed")) { icon = "👤"; nodeClass = "timeline-node node-amber"; }
                else if (event.text.includes("Task added")) { icon = "✅"; nodeClass = "timeline-node node-purple"; }
                else if (event.text.includes("Task updated")) { icon = "✏️"; nodeClass = "timeline-node node-purple"; }
                else if (event.text.includes("Comment added")) { icon = "💬"; nodeClass = "timeline-node node-gray"; }
                else if (event.text.includes("AI") || event.text.includes("agent") || event.text.includes("open comments")) { icon = "🤖"; nodeClass = "timeline-node node-cyan"; }
                else if (event.text.includes("changed") || event.text.includes("deployed") || event.text.includes("rollback") || event.text.includes("Live")) { icon = "🔄"; nodeClass = "timeline-node node-amber"; }
                else if (event.text.includes("created")) { icon = "🚀"; nodeClass = "timeline-node node-green"; }

                return (
                  <li key={event.id}>
                    <span className={nodeClass} aria-hidden>{icon}</span>
                    <div className="timeline-content">
                      <div className="timeline-meta">
                        <time>{event.time}</time>
                        <span className="timeline-actor">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4, verticalAlign:"-2px"}}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="m8 12 4 4 4-4"/></svg>
                          AI Agent
                        </span>
                      </div>
                      <p>{event.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {activeTab === "logs" ? (
          <section className="project-tab-surface logs-wrap">
            <h3>Logs</h3>
            <ul>
              {selectedProject.deployments.length === 0 ? <li>No deployment logs yet.</li> : null}
              {selectedProject.deployments.map((deployment) => (
                <li key={deployment.id}>
                  <span>{deployment.version}</span>
                  <span>{deployment.status}</span>
                  <time>{deployment.deployedAt}</time>
                </li>
              ))}
              <li>
                <span>Comment Pipeline</span>
                <span>open={selectedProject.commentSummary.open}</span>
                <time>{formatDateLabel(selectedProject.updatedAt)}</time>
              </li>
            </ul>
          </section>
        ) : null}

        {teamPopupOpen ? (
          <div className="project-team-modal-backdrop" role="dialog" aria-modal="true" aria-label="Project team members">
            <section className="project-team-modal">
              <header>
                <h3>Project Members</h3>
                <button type="button" className="action-btn-ghost" onClick={() => setTeamPopupOpen(false)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6, verticalAlign: "-3px"}}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>Close</button>
              </header>

              {!showAddMemberForm ? (
                <button type="button" className="action-btn-primary add-member-toggle" onClick={() => setShowAddMemberForm(true)}>
                  + Add Member
                </button>
              ) : (
                <div className="add-member-form">
                  <div className="add-member-search-wrap">
                    <input
                      type="text"
                      placeholder="Search admin/developer/qa members..."
                      value={teamMemberSearch}
                      onChange={(e) => setTeamMemberSearch(e.target.value)}
                    />
                  </div>
                  <div className="add-member-candidates">
                    {availableAdminMembers.slice(0, 6).map((member) => (
                      <button key={member.id} type="button" className="add-member-candidate" onClick={() => addMemberToTeam(member.id)}>
                        <img src={member.avatarUrl} alt={member.displayName} />
                        <div>
                          <strong>{member.displayName}</strong>
                          <span>{member.email}</span>
                        </div>
                        <em>{memberRoleLabel(member.role)}</em>
                      </button>
                    ))}
                    {availableAdminMembers.length === 0 ? <p className="add-member-empty">No available members match your search.</p> : null}
                  </div>
                  <input type="text" placeholder="Invite by name..." value={addMemberName} onChange={(e) => setAddMemberName(e.target.value)} />
                  <input type="email" placeholder="Invite by email..." value={addMemberEmail} onChange={(e) => setAddMemberEmail(e.target.value)} />
                  <select value={addMemberRole} onChange={(e) => setAddMemberRole(e.target.value)}>
                    <option value="developer">Developer</option>
                    <option value="qa">QA</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="button" className="action-btn-primary" onClick={handleInviteMember}>Send Invite</button>
                  <button type="button" className="action-btn-ghost" onClick={() => setShowAddMemberForm(false)}>Cancel</button>
                </div>
              )}

              <ul>
                {selectedMembers.map((member) => (
                  <li key={member.id}>
                    <div className="member-main">
                      <img src={member.avatarUrl} alt={member.displayName} />
                      <div>
                        <strong>{member.displayName}</strong>
                        <div className="member-chips">
                          <span className={`role-chip role-${member.role}`}>{memberRoleLabel(member.role)}</span>
                          <span className="status-chip status-active">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="project-member-row-actions">
                      <button
                        type="button"
                        className="project-member-remove-btn"
                        aria-label={`Remove ${member.displayName}`}
                        title="Remove Member"
                        onClick={() => setMemberRemoveTarget(member)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {memberRemoveTarget ? (
          <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Remove ${memberRemoveTarget.displayName}`}>
            <section className="projects-modal confirm-modal">
              <h3>Remove Team Member</h3>
              <p>
                {memberRemoveTarget.displayName} currently has {selectedMemberTaskCounts[memberRemoveTarget.id] ?? 0} task(s) on this project. Are you sure you want to remove them?
              </p>
              <div className="modal-actions">
                <button type="button" className="projects-secondary-btn" onClick={() => setMemberRemoveTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="projects-danger-btn" onClick={confirmRemoveMember}>
                  Remove Member
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {createModalOpen ? (
          <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create project">
            <section className="projects-modal">
              <h3>Create Project</h3>
              <label>
                Project Name
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Project name" />
              </label>
              <label>
                Description
                <textarea
                  rows={4}
                  value={createDescription}
                  onChange={(event) => setCreateDescription(event.target.value)}
                  placeholder="Describe this project"
                />
              </label>
              <label>
                Project Avatar (optional)
                <input type="file" accept="image/*" onChange={(event) => setCreateAvatarFile(event.target.files?.[0] ?? null)} />
              </label>
              {createAvatarFile ? <p className="projects-modal-subtitle">Selected: {createAvatarFile.name}</p> : null}
              <div className="modal-actions">
                <button type="button" className="projects-secondary-btn" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="projects-primary-btn" onClick={() => void handleCreateProject()}>
                  {busyAction === "create-project" ? "Creating..." : "Create Project"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {editModalOpen ? (
          <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit project">
            <section className="projects-modal">
              <h3>Edit Project</h3>
              <label>
                Project Name
                <input value={editName} onChange={(event) => setEditName(event.target.value)} />
              </label>
              <label>
                Description
                <textarea rows={4} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </label>
              <label>
                Status
                <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                  <option>Draft</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="projects-secondary-btn" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="projects-primary-btn" onClick={() => void handleSaveProjectEdit()}>
                  Save
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showArchiveConfirm && selectedProject ? (
          <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Archive project">
            <section className="projects-modal confirm-modal">
              <h3>Archive Project</h3>
              <p>This project will be archived and hidden from active projects.</p>
              <div className="modal-actions">
                <button type="button" className="projects-secondary-btn" onClick={() => setShowArchiveConfirm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="projects-danger-btn"
                  onClick={() => void handleArchiveProject(selectedProject.id)}
                >
                  Archive
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
  };

  if (loading) {
    return (
      <section className="projects-empty-state">
        <h2>Loading projects...</h2>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="projects-empty-state">
        <h2>Unable to load Projects</h2>
        <p>{errorMessage}</p>
        <button type="button" onClick={() => void loadProjects()}>
          Retry
        </button>
      </section>
    );
  }

  if (selectedProjectId) {
    return renderDetailsPage();
  }

  return renderMainPage();
}
