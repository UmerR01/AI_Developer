import { getStoredAccessToken } from "../auth/session";
import type {
  ProjectMutationResponse,
  ProjectMutationResult,
  ProjectQueryResponse,
  ProjectRecord,
  ProjectsQueryResponse,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8011";

const PROJECT_FIELDS = `
  id
  slug
  name
  owner
  ownerId
  description
  state
  updatedAt
  createdAt
  isDeleted
  folderPath
  usedStorage
  storage {
    id
    totalQuota
    usedSpace
    folderName
  }
  tasks {
    id
    title
    assignee
    status
  }
  activity {
    id
    text
    time
  }
  artifacts {
    id
    name
    type
  }
  commentSummary {
    open
    approved
    pushed
  }
  deployments {
    id
    version
    status
    deployedAt
  }
  teamMembers {
    id
    userId
    username
    displayName
    email
    role
    status
    invitedById
    invitedByName
    dateInvited
    dateJoined
  }
  files {
    id
    projectId
    uploadedById
    uploadedByName
    fileName
    filePath
    fileSize
    fileType
    uploadedAt
  }
`;

const PROJECTS_QUERY = `
  query Projects($search: String, $sortBy: String) {
    projects(search: $search, sortBy: $sortBy) {
      ${PROJECT_FIELDS}
    }
  }
`;

const PROJECT_QUERY = `
  query Project($projectId: ID!) {
    project(projectId: $projectId) {
      ${PROJECT_FIELDS}
    }
  }
`;

const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const ADD_COMMENT_MUTATION = `
  mutation AddProjectComment($input: AddProjectCommentInput!) {
    addProjectComment(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const UPDATE_PROJECT_MUTATION = `
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const DELETE_PROJECT_MUTATION = `
  mutation DeleteProject($input: ProjectActionInput!) {
    deleteProject(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const RESTORE_PROJECT_MUTATION = `
  mutation RestoreProject($input: ProjectActionInput!) {
    restoreProject(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const UPLOAD_FILE_MUTATION = `
  mutation UploadFile($input: UploadFileInput!) {
    uploadFile(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const DELETE_FILE_MUTATION = `
  mutation DeleteFile($input: DeleteFileInput!) {
    deleteFile(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const DEPLOY_MUTATION = `
  mutation DeployProject($input: DeployProjectInput!) {
    deployProject(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const START_AGENT_MUTATION = `
  mutation StartAgentRun($input: ProjectActionInput!) {
    startAgentRun(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const REVIEW_AND_PUSH_MUTATION = `
  mutation ReviewAndPushComments($input: ProjectActionInput!) {
    reviewAndPushComments(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

const ROLLBACK_MUTATION = `
  mutation RollbackProject($input: ProjectActionInput!) {
    rollbackProject(input: $input) {
      success
      message
      project {
        ${PROJECT_FIELDS}
      }
    }
  }
`;

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const accessToken = getStoredAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/graphql/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error("Unable to reach GraphQL service.");
  }

  return (await response.json()) as T;
}

function toErrorResult(message: string): ProjectMutationResult {
  return {
    success: false,
    message,
    project: null,
  };
}

export async function fetchProjects(search?: string, sortBy?: string): Promise<ProjectRecord[]> {
  const payload = await graphqlRequest<ProjectsQueryResponse>(PROJECTS_QUERY, { search: search || null, sortBy: sortBy || null });

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data?.projects ?? [];
}

export async function fetchProjectById(projectId: string): Promise<ProjectRecord | null> {
  const payload = await graphqlRequest<ProjectQueryResponse>(PROJECT_QUERY, { projectId });
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data?.project ?? null;
}

export async function createProject(name: string, description: string): Promise<ProjectMutationResult> {
  try {
    const payload = await graphqlRequest<ProjectMutationResponse>(CREATE_PROJECT_MUTATION, {
      input: { name, description },
    });

    if (payload.errors?.length) {
      return toErrorResult(payload.errors[0].message);
    }

    return payload.data?.createProject ?? toErrorResult("Unexpected create project response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Create project request failed.");
  }
}

export async function addProjectComment(projectId: string, comment: string): Promise<ProjectMutationResult> {
  try {
    const payload = await graphqlRequest<ProjectMutationResponse>(ADD_COMMENT_MUTATION, {
      input: { projectId, comment },
    });

    if (payload.errors?.length) {
      return toErrorResult(payload.errors[0].message);
    }

    return payload.data?.addProjectComment ?? toErrorResult("Unexpected add comment response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Add comment request failed.");
  }
}

export async function updateProject(
  projectId: string,
  payload: { name?: string; description?: string; status?: string },
): Promise<ProjectMutationResult> {
  try {
    const response = await graphqlRequest<ProjectMutationResponse>(UPDATE_PROJECT_MUTATION, {
      input: { projectId, ...payload },
    });
    if (response.errors?.length) {
      return toErrorResult(response.errors[0].message);
    }
    return response.data?.updateProject ?? toErrorResult("Unexpected update project response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Update project request failed.");
  }
}

export async function archiveProject(projectId: string): Promise<ProjectMutationResult> {
  try {
    const response = await graphqlRequest<ProjectMutationResponse>(DELETE_PROJECT_MUTATION, {
      input: { projectId },
    });
    if (response.errors?.length) {
      return toErrorResult(response.errors[0].message);
    }
    return response.data?.deleteProject ?? toErrorResult("Unexpected archive project response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Archive project request failed.");
  }
}

export async function restoreProject(projectId: string): Promise<ProjectMutationResult> {
  try {
    const response = await graphqlRequest<ProjectMutationResponse>(RESTORE_PROJECT_MUTATION, {
      input: { projectId },
    });
    if (response.errors?.length) {
      return toErrorResult(response.errors[0].message);
    }
    return response.data?.restoreProject ?? toErrorResult("Unexpected restore project response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Restore project request failed.");
  }
}

export async function uploadProjectFile(input: {
  projectId: string;
  uploadedById: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
}): Promise<ProjectMutationResult> {
  try {
    const response = await graphqlRequest<ProjectMutationResponse>(UPLOAD_FILE_MUTATION, { input });
    if (response.errors?.length) {
      return toErrorResult(response.errors[0].message);
    }
    const payload = response.data?.uploadFile;
    if (!payload) {
      return toErrorResult("Unexpected upload file response.");
    }
    return {
      success: payload.success,
      message: payload.message,
      project: payload.project,
    };
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Upload file request failed.");
  }
}

export async function deleteProjectFile(fileId: string): Promise<ProjectMutationResult> {
  try {
    const response = await graphqlRequest<ProjectMutationResponse>(DELETE_FILE_MUTATION, {
      input: { fileId },
    });
    if (response.errors?.length) {
      return toErrorResult(response.errors[0].message);
    }
    const payload = response.data?.deleteFile;
    if (!payload) {
      return toErrorResult("Unexpected delete file response.");
    }
    return {
      success: payload.success,
      message: payload.message,
      project: payload.project,
    };
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Delete file request failed.");
  }
}

export async function deployProject(projectId: string, versionLabel?: string): Promise<ProjectMutationResult> {
  try {
    const payload = await graphqlRequest<ProjectMutationResponse>(DEPLOY_MUTATION, {
      input: { projectId, versionLabel: versionLabel || null },
    });

    if (payload.errors?.length) {
      return toErrorResult(payload.errors[0].message);
    }

    return payload.data?.deployProject ?? toErrorResult("Unexpected deploy response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Deploy request failed.");
  }
}

export async function startAgentRun(projectId: string): Promise<ProjectMutationResult> {
  try {
    const payload = await graphqlRequest<ProjectMutationResponse>(START_AGENT_MUTATION, {
      input: { projectId },
    });

    if (payload.errors?.length) {
      return toErrorResult(payload.errors[0].message);
    }

    return payload.data?.startAgentRun ?? toErrorResult("Unexpected agent run response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Start agent run request failed.");
  }
}

export async function reviewAndPushComments(projectId: string): Promise<ProjectMutationResult> {
  try {
    const payload = await graphqlRequest<ProjectMutationResponse>(REVIEW_AND_PUSH_MUTATION, {
      input: { projectId },
    });

    if (payload.errors?.length) {
      return toErrorResult(payload.errors[0].message);
    }

    return payload.data?.reviewAndPushComments ?? toErrorResult("Unexpected review/push response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Review/push request failed.");
  }
}

export async function rollbackProject(projectId: string): Promise<ProjectMutationResult> {
  try {
    const payload = await graphqlRequest<ProjectMutationResponse>(ROLLBACK_MUTATION, {
      input: { projectId },
    });

    if (payload.errors?.length) {
      return toErrorResult(payload.errors[0].message);
    }

    return payload.data?.rollbackProject ?? toErrorResult("Unexpected rollback response.");
  } catch (error) {
    return toErrorResult(error instanceof Error ? error.message : "Rollback request failed.");
  }
}
