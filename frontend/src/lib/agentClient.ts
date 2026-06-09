/**
 * Agent API helpers (FastAPI on NEXT_PUBLIC_AI_AGENT_URL, often proxied at /agent).
 */

export interface AgentPreviewMeta {
  status: string;
  preview_url?: string;
  preview_error?: string;
  project_type?: string;
  can_preview?: boolean;
}

export function agentBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_AI_AGENT_URL ?? "http://localhost:8001").replace(/\/+$/, "");
}

export function agentWebSocketUrl(): string {
  const base = agentBaseUrl();
  const wsBase = base.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${wsBase}/ws/chat`;
}

/** user_id for agent routes — matches storage/{username}/… on disk */
export function inferAgentUserId(folderPath: string): string {
  const parts = folderPath.replace(/\\/g, "/").split("/").filter(Boolean);
  const idx = parts.indexOf("storage");
  if (idx >= 0 && parts[idx + 1]) {
    return parts[idx + 1].replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  return "default";
}

export function agentProjectKey(projectId: string): string {
  const raw = String(projectId).trim();
  return raw.startsWith("project-") ? raw : `project-${raw}`;
}

export function buildAgentWorkspaceUrl(input: {
  projectId: string;
  projectName: string;
  sessionId?: string;
  userId?: string;
  autostart?: boolean;
}): string {
  const session = input.sessionId ?? agentProjectKey(input.projectId);
  const params = new URLSearchParams({
    projectId: input.projectId,
    projectName: input.projectName,
    session,
    ws: agentWebSocketUrl(),
  });
  if (input.autostart) {
    params.set("autostart", "1");
  }
  if (input.userId) {
    params.set("userId", input.userId);
  }
  return `${agentBaseUrl()}/workspace?${params.toString()}`;
}

export function buildAgentPreviewUrl(userId: string, projectId: string): string {
  const u = encodeURIComponent(userId);
  const p = encodeURIComponent(agentProjectKey(projectId));
  return `${agentBaseUrl()}/preview/${u}/${p}/`;
}

export async function bootstrapAgentSession(input: {
  sessionId: string;
  prompt: string;
  projectId: string;
  projectName: string;
  workingDirectory?: string;
  userId?: string;
}): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${agentBaseUrl()}/api/session/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: input.sessionId,
      prompt: input.prompt,
      working_directory: input.workingDirectory || undefined,
      project_id: agentProjectKey(input.projectId),
      project_name: input.projectName,
      user_id: input.userId,
    }),
  });

  if (!response.ok) {
    return { success: false, message: `Agent bootstrap failed with HTTP ${response.status}.` };
  }

  const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
  if (payload?.success === false) {
    return { success: false, message: payload.message || "Agent server could not store the prompt." };
  }

  return { success: true };
}

export async function fetchProjectPreview(
  userId: string,
  projectId: string,
): Promise<AgentPreviewMeta | null> {
  const u = encodeURIComponent(userId);
  const p = encodeURIComponent(agentProjectKey(projectId));
  const response = await fetch(`${agentBaseUrl()}/api/projects/${u}/${p}/preview`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AgentPreviewMeta;
}

export async function rebuildProjectPreview(
  userId: string,
  projectId: string,
  force = true,
): Promise<AgentPreviewMeta | null> {
  const u = encodeURIComponent(userId);
  const p = encodeURIComponent(agentProjectKey(projectId));
  const response = await fetch(
    `${agentBaseUrl()}/api/projects/${u}/${p}/preview/rebuild?force=${force ? "true" : "false"}`,
    { method: "POST" },
  );
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AgentPreviewMeta;
}

/** Prefer a locally-built workspace URL when Django/agent returns localhost. */
export function resolveAgentWorkspaceUrl(
  backendUrl: string | null | undefined,
  input: {
    projectId: string;
    projectName: string;
    sessionId?: string;
    userId?: string;
    autostart?: boolean;
  },
): string {
  const built = buildAgentWorkspaceUrl(input);
  const raw = (backendUrl || "").trim();
  if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) {
    return built;
  }
  return raw;
}

export function resolvePreviewOpenUrl(meta: AgentPreviewMeta | null, userId: string, projectId: string): string {
  const url = meta?.preview_url?.trim();
  if (url && !url.includes("localhost") && !url.includes("127.0.0.1")) {
    return url;
  }
  return buildAgentPreviewUrl(userId, projectId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiered Context Strategy helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface FileSummaryResult {
  file_path: string;
  summary: string;
  tokens_estimated: number;
  cached: boolean;
}

/**
 * Call the agent-server summarize endpoint for a single project file.
 * Returns null if the request fails (caller can fall back to full-file send).
 */
export async function summarizeFile(
  userId: string,
  projectId: string,
  filePath: string,
  forceRefresh = false,
): Promise<FileSummaryResult | null> {
  try {
    const u = encodeURIComponent(userId);
    const p = encodeURIComponent(agentProjectKey(projectId));
    const response = await fetch(
      `${agentBaseUrl()}/api/projects/${u}/${p}/file/summarize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, force_refresh: forceRefresh }),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as FileSummaryResult;
  } catch {
    return null;
  }
}

/** Keywords that indicate the user wants to modify / write a file. */
const MODIFY_KEYWORDS = [
  "update",
  "modify",
  "change",
  "edit",
  "fix",
  "add",
  "remove",
  "delete",
  "refactor",
  "implement",
  "rewrite",
  "create",
  "build",
  "replace",
  "insert",
  "append",
  "rename",
  "move",
  "convert",
  "migrate",
];

/**
 * Classify user prompt as a read-only "read" operation or a write "modify"
 * operation.  Used by the context manager to decide how much context to send.
 */
export function detectOperationType(prompt: string): "read" | "modify" {
  const lower = prompt.toLowerCase();
  for (const kw of MODIFY_KEYWORDS) {
    if (lower.includes(kw)) return "modify";
  }
  return "read";
}

/**
 * Assemble the tiered context prompt to inject into the WS message.
 *
 * - Read operation  → inject only the file summary (if available).
 * - Modify (turn>0) → inject summary + ordered list of previously applied patches.
 * - Modify (turn=0) → send plain prompt; caller should attach the full file separately.
 */
export function buildContextPayload(opts: {
  prompt: string;
  opType?: "read" | "modify";
  fileSummary?: string | null;
  appliedPatches?: string[];
  isFirstModify?: boolean;
}): string {
  const { prompt, opType = "read", fileSummary, appliedPatches = [], isFirstModify = false } = opts;

  if (opType === "read" && fileSummary) {
    return (
      `[FILE STRUCTURAL SUMMARY]\n${fileSummary}\n[END SUMMARY]\n\n` + prompt
    );
  }

  if (opType === "modify" && !isFirstModify) {
    const parts: string[] = [];

    if (fileSummary) {
      parts.push(`[FILE STRUCTURAL SUMMARY]\n${fileSummary}\n[END SUMMARY]`);
    }

    if (appliedPatches.length > 0) {
      parts.push(
        `[PATCHES APPLIED SO FAR (${appliedPatches.length})]\n` +
          appliedPatches
            .map((p, i) => `--- Patch ${i + 1} ---\n${p}`)
            .join("\n\n") +
          "\n[END PATCHES]",
      );
    }

    parts.push(prompt);
    return parts.join("\n\n");
  }

  // First modify turn or no summary available — send plain prompt
  return prompt;
}

