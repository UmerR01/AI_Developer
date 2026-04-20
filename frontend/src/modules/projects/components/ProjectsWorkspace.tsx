"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { PROJECTS_DATA } from "../data/mockProjectsData";
import type { ProjectRecord, ProjectState, ProjectView } from "../types";

interface ProjectsWorkspaceProps {
  selectedProjectId?: string;
}

type SortOption = "updated" | "name" | "state";

function isValidView(value: string | null): value is ProjectView {
  return value === "overview" || value === "review" || value === "deployments";
}

function makeProjectId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function nowLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(
    now.getHours()
  ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function ProjectsWorkspace({ selectedProjectId }: ProjectsWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectRecord[]>(PROJECTS_DATA);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [localSelectedProjectId, setLocalSelectedProjectId] = useState<string>(selectedProjectId ?? PROJECTS_DATA[0].id);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const queryView = searchParams.get("view");
  const currentView: ProjectView = isValidView(queryView) ? queryView : "overview";

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      if (!searchText.trim()) {
        return true;
      }
      const normalized = searchText.trim().toLowerCase();
      return project.name.toLowerCase().includes(normalized) || project.state.toLowerCase().includes(normalized);
    });

    return filtered.sort((first, second) => {
      if (sortBy === "name") {
        return first.name.localeCompare(second.name);
      }
      if (sortBy === "state") {
        return first.state.localeCompare(second.state);
      }
      return second.updatedAt.localeCompare(first.updatedAt);
    });
  }, [projects, searchText, sortBy]);

  const selectedId = selectedProjectId ?? localSelectedProjectId;

  const selectedProject = useMemo(() => {
    const exactMatch = projects.find((project) => project.id === selectedId);
    if (exactMatch) {
      return exactMatch;
    }
    return filteredProjects[0] ?? null;
  }, [projects, selectedId, filteredProjects]);

  const setView = (view: ProjectView) => {
    if (!selectedProject) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);

    if (pathname === "/projects") {
      router.push(`/projects/${selectedProject.id}?${params.toString()}`);
      return;
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const selectProject = (projectId: string) => {
    setLocalSelectedProjectId(projectId);

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", currentView);
    router.push(`/projects/${projectId}?${params.toString()}`);
  };

  const updateProject = (projectId: string, updater: (project: ProjectRecord) => ProjectRecord) => {
    setProjects((current) => current.map((project) => (project.id === projectId ? updater(project) : project)));
  };

  const handleCreateProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      return;
    }

    const idBase = makeProjectId(trimmedName);
    const dedupeSuffix = projects.some((project) => project.id === idBase) ? `-${projects.length + 1}` : "";
    const projectId = `${idBase}${dedupeSuffix}`;

    const newProject: ProjectRecord = {
      id: projectId,
      name: trimmedName,
      owner: "Current User",
      description: newProjectDescription.trim() || "New project draft ready for setup and agent tasking.",
      state: "Draft",
      updatedAt: nowLabel(),
      tasks: [],
      activity: [{ id: `act-${projectId}-1`, text: "Project created in Draft state", time: "Now" }],
      artifacts: [],
      commentSummary: { open: 0, approved: 0, pushed: 0 },
      deployments: [],
    };

    setProjects((current) => [newProject, ...current]);
    setLocalSelectedProjectId(newProject.id);
    setNewProjectName("");
    setNewProjectDescription("");
    setCreateModalOpen(false);
    router.push("/projects");
  };

  const setState = (projectId: string, state: ProjectState, activityText: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      state,
      updatedAt: nowLabel(),
      activity: [{ id: `${project.id}-${Date.now()}`, text: activityText, time: "Now" }, ...project.activity],
    }));
  };

  const handleStartAgentRun = () => {
    if (!selectedProject) {
      return;
    }
    setState(selectedProject.id, "In Progress", "Agent run started from Projects workspace");
  };

  const handleAddComment = () => {
    if (!selectedProject) {
      return;
    }

    updateProject(selectedProject.id, (project) => ({
      ...project,
      updatedAt: nowLabel(),
      commentSummary: {
        ...project.commentSummary,
        open: project.commentSummary.open + 1,
      },
      activity: [{ id: `${project.id}-${Date.now()}`, text: "Comment added to review queue", time: "Now" }, ...project.activity],
    }));
  };

  const handleReviewAndPush = () => {
    if (!selectedProject || selectedProject.commentSummary.open === 0) {
      return;
    }

    updateProject(selectedProject.id, (project) => ({
      ...project,
      state: "Revising",
      updatedAt: nowLabel(),
      commentSummary: {
        open: 0,
        approved: project.commentSummary.approved + project.commentSummary.open,
        pushed: project.commentSummary.pushed + project.commentSummary.open,
      },
      activity: [{ id: `${project.id}-${Date.now()}`, text: "Approved comments pushed to agent", time: "Now" }, ...project.activity],
    }));
  };

  const handleDeploy = () => {
    if (!selectedProject) {
      return;
    }

    updateProject(selectedProject.id, (project) => ({
      ...project,
      state: "Live",
      updatedAt: nowLabel(),
      deployments: [
        {
          id: `deploy-${Date.now()}`,
          version: `v0.${project.deployments.length + 7}.0`,
          status: "success",
          deployedAt: nowLabel(),
        },
        ...project.deployments,
      ],
      activity: [{ id: `${project.id}-${Date.now()}`, text: "Project deployed to Live", time: "Now" }, ...project.activity],
    }));
  };

  const handleRollback = () => {
    if (!selectedProject || selectedProject.deployments.length === 0) {
      return;
    }

    updateProject(selectedProject.id, (project) => ({
      ...project,
      state: "In Review",
      updatedAt: nowLabel(),
      deployments: [
        {
          id: `rollback-${Date.now()}`,
          version: project.deployments[0].version,
          status: "rollback",
          deployedAt: nowLabel(),
        },
        ...project.deployments,
      ],
      activity: [{ id: `${project.id}-${Date.now()}`, text: "Rollback executed to previous stable version", time: "Now" }, ...project.activity],
    }));
  };

  if (!selectedProject) {
    return (
      <section className="projects-empty">
        <h2>No projects found</h2>
        <p>Create your first project to begin the pipeline flow.</p>
        <button type="button" className="projects-primary-btn" onClick={() => setCreateModalOpen(true)}>
          Create Project
        </button>
      </section>
    );
  }

  return (
    <section className="projects-shell">
      <section className="projects-left-panel dashboard-card">
        <div className="projects-panel-head">
          <h2>Projects</h2>
          <button type="button" className="projects-primary-btn" onClick={() => setCreateModalOpen(true)}>
            Create Project
          </button>
        </div>

        <div className="projects-filter-row">
          <input
            type="text"
            placeholder="Search by name or state"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
            <option value="updated">Sort: Recently updated</option>
            <option value="name">Sort: Name</option>
            <option value="state">Sort: State</option>
          </select>
        </div>

        <ul className="project-list">
          {filteredProjects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className={`project-list-item ${project.id === selectedProject.id ? "active" : ""}`}
                onClick={() => selectProject(project.id)}
              >
                <strong>{project.name}</strong>
                <span>{project.state}</span>
                <em>{project.updatedAt}</em>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="projects-main-panel dashboard-card">
        <div className="projects-panel-head">
          <div>
            <h2>{selectedProject.name}</h2>
            <p>{selectedProject.description}</p>
          </div>
          <span className={`projects-state-badge state-${selectedProject.state.toLowerCase().replace(/\s+/g, "-")}`}>
            {selectedProject.state}
          </span>
        </div>

        <div className="project-actions-grid">
          <button type="button" className="projects-secondary-btn" onClick={() => selectProject(selectedProject.id)}>
            Open / Select Project
          </button>
          <button type="button" className="projects-secondary-btn" onClick={handleStartAgentRun}>
            Start Agent Run
          </button>
          <button type="button" className="projects-secondary-btn" onClick={handleAddComment}>
            Add Comment
          </button>
          <button type="button" className="projects-secondary-btn" onClick={handleReviewAndPush}>
            Review and Push Comments
          </button>
          <button type="button" className="projects-secondary-btn" onClick={handleDeploy}>
            Deploy
          </button>
          <button type="button" className="projects-secondary-btn" onClick={handleRollback}>
            Rollback
          </button>
        </div>

        <div className="project-view-tabs">
          <button type="button" className={currentView === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            Overview
          </button>
          <button type="button" className={currentView === "review" ? "active" : ""} onClick={() => setView("review")}>
            Review Queue
          </button>
          <button type="button" className={currentView === "deployments" ? "active" : ""} onClick={() => setView("deployments")}>
            Deployments
          </button>
        </div>

        {currentView === "overview" ? (
          <section className="project-context-grid">
            <article className="project-context-card">
              <h3>Activity</h3>
              <ul>
                {selectedProject.activity.map((item) => (
                  <li key={item.id}>
                    <span>{item.text}</span>
                    <em>{item.time}</em>
                  </li>
                ))}
              </ul>
            </article>

            <article className="project-context-card">
              <h3>Artifacts</h3>
              <ul>
                {selectedProject.artifacts.map((artifact) => (
                  <li key={artifact.id}>
                    <span>{artifact.name}</span>
                    <em>{artifact.type}</em>
                  </li>
                ))}
              </ul>
            </article>

            <article className="project-context-card">
              <h3>Tasks</h3>
              <ul>
                {selectedProject.tasks.map((task) => (
                  <li key={task.id}>
                    <span>{task.title}</span>
                    <em>
                      {task.assignee} | {task.status}
                    </em>
                  </li>
                ))}
              </ul>
            </article>

            <article className="project-context-card">
              <h3>Comment Summary</h3>
              <ul>
                <li>
                  <span>Open comments</span>
                  <em>{selectedProject.commentSummary.open}</em>
                </li>
                <li>
                  <span>Approved</span>
                  <em>{selectedProject.commentSummary.approved}</em>
                </li>
                <li>
                  <span>Pushed</span>
                  <em>{selectedProject.commentSummary.pushed}</em>
                </li>
              </ul>
            </article>
          </section>
        ) : null}

        {currentView === "review" ? (
          <section className="project-context-card full-width">
            <h3>Review Queue</h3>
            <p>
              Open comments: {selectedProject.commentSummary.open}. Approved comments: {selectedProject.commentSummary.approved}. Pushed batches: {selectedProject.commentSummary.pushed}.
            </p>
            <p className="review-link-row">
              Team assignment link: <Link href="/team">Open Team Workspace</Link>
            </p>
          </section>
        ) : null}

        {currentView === "deployments" ? (
          <section className="project-context-card full-width">
            <h3>Deployments</h3>
            <ul>
              {selectedProject.deployments.length === 0 ? <li>No deployments yet</li> : null}
              {selectedProject.deployments.map((deployment) => (
                <li key={deployment.id}>
                  <span>
                    {deployment.version} | {deployment.status}
                  </span>
                  <em>{deployment.deployedAt}</em>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      {createModalOpen ? (
        <div className="projects-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create Project">
          <form className="projects-modal" onSubmit={handleCreateProject}>
            <h3>Create Project</h3>
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Enter project name"
            />

            <label htmlFor="project-description">Description</label>
            <textarea
              id="project-description"
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              placeholder="Short context for this project"
              rows={3}
            />

            <div className="modal-actions">
              <button type="button" className="projects-secondary-btn" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="projects-primary-btn">
                Create
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
