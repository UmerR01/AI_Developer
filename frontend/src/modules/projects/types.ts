export type ProjectView = "overview" | "review" | "deployments";

export type ProjectState = "Draft" | "In Progress" | "In Review" | "Pending Push" | "Revising" | "Live";

export interface ProjectTask {
  id: string;
  title: string;
  assignee: string;
  status: "todo" | "in_progress" | "done";
}

export interface ProjectActivity {
  id: string;
  text: string;
  time: string;
}

export interface ProjectArtifact {
  id: string;
  name: string;
  type: "spec" | "code" | "design" | "test";
}

export interface ProjectDeployment {
  id: string;
  version: string;
  status: "success" | "rollback";
  deployedAt: string;
}

export interface CommentSummary {
  open: number;
  approved: number;
  pushed: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  owner: string;
  description: string;
  state: ProjectState;
  updatedAt: string;
  tasks: ProjectTask[];
  activity: ProjectActivity[];
  artifacts: ProjectArtifact[];
  commentSummary: CommentSummary;
  deployments: ProjectDeployment[];
}
