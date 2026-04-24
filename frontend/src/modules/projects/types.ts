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

export interface StorageInfo {
  id: string;
  totalQuota: number;
  usedSpace: number;
  folderName: string;
}

export interface TeamMemberRecord {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  role: "developer" | "qa";
  status: "pending" | "active" | "removed";
  invitedById?: string | null;
  invitedByName?: string | null;
  dateInvited: string;
  dateJoined?: string | null;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  uploadedById?: string | null;
  uploadedByName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
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
  slug: string;
  name: string;
  owner: string;
  ownerId?: string | null;
  description: string;
  state: ProjectState;
  updatedAt: string;
  createdAt: string;
  isDeleted: boolean;
  folderPath: string;
  usedStorage: number;
  storage?: StorageInfo | null;
  tasks: ProjectTask[];
  activity: ProjectActivity[];
  artifacts: ProjectArtifact[];
  commentSummary: CommentSummary;
  deployments: ProjectDeployment[];
  teamMembers: TeamMemberRecord[];
  files: ProjectFile[];
}

export interface ProjectMutationResult {
  success: boolean;
  message: string;
  project?: ProjectRecord | null;
}

export interface ProjectsQueryResponse {
  data?: {
    projects: ProjectRecord[];
  };
  errors?: Array<{ message: string }>;
}

export interface ProjectQueryResponse {
  data?: {
    project: ProjectRecord | null;
  };
  errors?: Array<{ message: string }>;
}

export interface ProjectMutationResponse {
  data?: {
    createProject?: ProjectMutationResult;
    updateProject?: ProjectMutationResult;
    deleteProject?: ProjectMutationResult;
    restoreProject?: ProjectMutationResult;
    addProjectComment?: ProjectMutationResult;
    deployProject?: ProjectMutationResult;
    startAgentRun?: ProjectMutationResult;
    reviewAndPushComments?: ProjectMutationResult;
    rollbackProject?: ProjectMutationResult;
    uploadFile?: {
      success: boolean;
      message: string;
      project?: ProjectRecord | null;
    };
    deleteFile?: {
      success: boolean;
      message: string;
      project?: ProjectRecord | null;
    };
  };
  errors?: Array<{ message: string }>;
}
