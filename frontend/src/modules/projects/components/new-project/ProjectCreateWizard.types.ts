import type { ProjectBriefReviewResult, CreateProjectInput } from "../../types";

export type ProjectCreateStep = 1 | 2 | 3 | 4;
export type ProjectDescriptionMode = "write" | "upload";
export type GitHubAuthMode = "repo_url" | "personal_access_token";

export interface SessionAnswer {
  question: string;
  answer: string;
}

export interface GitHubConnectionState {
  status: "idle" | "checking" | "success" | "error";
  message: string;
  repositoryName: string;
}

export interface ProjectCreateWizardPayload extends CreateProjectInput {
  brief?: string;
  revisionNotes?: string;
  sessionAnswers?: SessionAnswer[];
  documentText?: string;
}

export interface ProjectReviewState extends ProjectBriefReviewResult {
  sourceSummary: string;
}