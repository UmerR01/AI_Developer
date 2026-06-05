import { getStoredUser } from "../auth/session";

export type ReferenceMode = "design" | "error";

export function agentBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_AI_AGENT_URL ?? "http://localhost:8001").replace(/\/+$/, "");
}

export function agentWebSocketUrl(): string {
  const base = agentBaseUrl();
  return base.replace(/^http:/, "ws:").replace(/^https:/, "wss:") + "/ws/chat";
}

export function resolveUserId(): string {
  const user = getStoredUser();
  return (user?.username || user?.id || "default").toString();
}

export function buildNextAgentWorkspacePath(
  projectId: string,
  sessionId: string,
  projectName?: string,
  autostart = true,
): string {
  const params = new URLSearchParams({
    session: sessionId,
  });
  if (projectName) {
    params.set("projectName", projectName);
  }
  if (autostart) {
    params.set("autostart", "1");
  }
  return `/projects/${encodeURIComponent(projectId)}/agent?${params.toString()}`;
}

export function buildAgentWorkspaceIframeUrl(input: {
  projectId: string;
  projectName?: string;
  sessionId: string;
  autostart?: boolean;
  userId?: string;
}): string {
  const baseUrl = agentBaseUrl();
  const params = new URLSearchParams({
    projectId: input.projectId,
    session: input.sessionId,
    ws: agentWebSocketUrl(),
    userId: input.userId || resolveUserId(),
  });
  if (input.projectName) {
    params.set("projectName", input.projectName);
  }
  if (input.autostart) {
    params.set("autostart", "1");
  }
  return `${baseUrl}/workspace?${params.toString()}`;
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
