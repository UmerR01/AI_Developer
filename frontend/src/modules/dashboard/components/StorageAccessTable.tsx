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
      <div className="card-head access-title-row">
        <div>
          <h2>Storage Access</h2>
          <p>You can grant access to all files in your space to anyone, as well as allow them to download and edit the files.</p>
        </div>
      </div>

      <div className="access-table" aria-label="Storage access list">
        {projects.map((project) => (
          <div className="access-row" key={project.id}>
            <strong>{project.name}</strong>
            <span>{project.filesTotal} Files</span>
            <span>{project.usedStorageGb} GB</span>
            <AvatarStack members={getProjectMembers(project, accountById)} />
            <Link className="share-access-btn" href={`/projects/${project.id}?view=${inferProjectView(project)}`} aria-label={`Open ${project.name}`}>
              Share access
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
