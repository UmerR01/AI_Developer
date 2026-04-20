import { AvatarStack } from "./AvatarStack";
import type { Account, StorageProject } from "../types";

interface StorageAccessTableProps {
  projects: StorageProject[];
  accountById: Record<string, Account>;
}

function getProjectMembers(project: StorageProject, accountById: Record<string, Account>): Account[] {
  return project.memberAccountIds.map((id) => accountById[id]).filter(Boolean);
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
            <button type="button" className="row-action-btn">
              Share Access
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
