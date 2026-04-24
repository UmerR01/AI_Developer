import Link from "next/link";

import { AvatarStack } from "./AvatarStack";
import type { Account, StorageProject } from "../types";

interface StorageAccessTableProps {
  projects: StorageProject[];
  accountById: Record<string, Account>;
}

function getProjectMembers(project: StorageProject, accountById: Record<string, Account>): Account[] {
  return project.memberAccountIds.map((id) => accountById[id]).filter(Boolean);
}

function inferProjectView(project: StorageProject): "overview" | "review" | "deployments" {
  const loweredName = project.name.toLowerCase();
  if (loweredName.includes("testing") || loweredName.includes("qc") || loweredName.includes("support")) {
    return "review";
  }
  return "overview";
}

export function StorageAccessTable({ projects, accountById }: StorageAccessTableProps) {
  return (
    <section className="dashboard-card access-card">
      <div className="card-head">
        <h2>Storage Access</h2>
      </div>

      <div className="access-table">
        <div className="access-head">
          <span>Project</span>
          <span>Space Taken</span>
          <span>Files Total</span>
          <span>Members</span>
          <span>Action</span>
        </div>
        {projects.map((project) => (
          <div className="access-row" key={project.id}>
            <strong>{project.name}</strong>
            <span>{project.usedStorageGb} GB</span>
            <span>{project.filesTotal} files</span>
            <AvatarStack members={getProjectMembers(project, accountById)} />
            <Link className="row-action-btn" href={`/projects/${project.id}?view=${inferProjectView(project)}`} aria-label={`Open ${project.name}`} title="Open Project">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 7.8c0-1.1.9-2 2-2h4l1.6 1.7h7.4c1.1 0 2 .9 2 2v6.8c0 1.1-.9 2-2 2H5.5c-1.1 0-2-.9-2-2V7.8Z" fill="none" stroke="currentColor" strokeWidth="1.7"/>
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
