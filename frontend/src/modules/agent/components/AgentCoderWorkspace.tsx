"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  agentProjectKey,
  fetchBootstrapSession,
  fetchProjectPreview,
  inferAgentUserId,
  normalizePreviewUrl,
  rebuildProjectPreview,
} from "../../../lib/agentClient";
import { useAgentSocket, type AgentSocketMessage } from "../hooks/useAgentSocket";
import "../agent-workspace.css";

export interface AgentCoderWorkspaceProps {
  projectId: string;
  projectName: string;
  sessionId: string;
  userId?: string;
  folderPath?: string;
  autostart?: boolean;
}

interface ChatLine {
  id: string;
  role: "user" | "agent" | "system" | "error";
  text: string;
}

export function AgentCoderWorkspace({
  projectId,
  projectName,
  sessionId,
  userId: userIdProp,
  folderPath = "",
  autostart = false,
}: AgentCoderWorkspaceProps) {
  const userId = userIdProp || inferAgentUserId(folderPath);
  const agentProjectId = agentProjectKey(projectId);

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [prompt, setPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewStatus, setPreviewStatus] = useState("idle");
  const [pendingAutostart, setPendingAutostart] = useState<string | null>(null);

  const pushLine = useCallback((role: ChatLine["role"], text: string) => {
    setLines((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role, text }]);
  }, []);

  const refreshPreview = useCallback(async () => {
    const meta = await fetchProjectPreview(userId, projectId);
    if (!meta) {
      return;
    }
    setPreviewStatus(meta.status || "idle");
    if (meta.status === "ready" && meta.preview_url) {
      setPreviewUrl(normalizePreviewUrl(meta.preview_url, userId, projectId));
    }
  }, [projectId, userId]);

  const onSocketMessage = useCallback(
    (payload: AgentSocketMessage) => {
      const type = String(payload.type || "");

      if (type === "socket_reconnecting") {
        pushLine("system", `Reconnecting (${payload.attempt})…`);
        return;
      }
      if (type === "socket_give_up") {
        pushLine("error", String(payload.message || "Reconnect failed"));
        return;
      }
      if (type === "llm_retry") {
        pushLine(
          "system",
          String(payload.message || `API busy — retry ${payload.attempt}/${payload.retries_allowed}…`),
        );
        return;
      }
      if (type === "workspace_ready") {
        if (payload.preview_url) {
          setPreviewUrl(
            normalizePreviewUrl(String(payload.preview_url), userId, projectId),
          );
        }
        setPreviewStatus(String(payload.status || "idle"));
        return;
      }
      if (type === "thinking" && payload.content) {
        pushLine("system", `Thinking: ${String(payload.content).slice(0, 280)}`);
        return;
      }
      if (type === "tool_start") {
        pushLine("system", `Tool: ${String(payload.tool || "tool")}…`);
        return;
      }
      if (type === "preview_building") {
        setPreviewStatus("building");
        pushLine("system", "Building app preview…");
        return;
      }
      if (type === "preview_ready") {
        setPreviewStatus("ready");
        if (payload.preview_url) {
          setPreviewUrl(
            normalizePreviewUrl(String(payload.preview_url), userId, projectId),
          );
        }
        pushLine("system", `Preview ready (${payload.project_type || "app"}).`);
        return;
      }
      if (type === "preview_failed") {
        setPreviewStatus("failed");
        pushLine("error", String(payload.error || "Preview build failed"));
        return;
      }
      if (type === "run_error") {
        pushLine("error", String(payload.error || "Agent run failed"));
        return;
      }
      if (type === "response" && payload.output) {
        pushLine("agent", String(payload.output));
        void refreshPreview();
        return;
      }
      if (type === "run_complete") {
        pushLine("system", "Run finished.");
        void refreshPreview();
        return;
      }
      if (type === "ack") {
        pushLine("system", "Generation started…");
        return;
      }
    },
    [pushLine, projectId, refreshPreview, userId],
  );

  const { status, generating, connected, connect, sendPrompt, stopGeneration, buildPreview } =
    useAgentSocket({
      sessionId,
      userId,
      projectId,
      onMessage: onSocketMessage,
    });

  useEffect(() => {
    if (!autostart) {
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await fetchBootstrapSession(sessionId);
      if (cancelled) {
        return;
      }
      const text = (data?.prompt || data?.development_prompt || "").trim();
      if (text) {
        setPendingAutostart(text);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autostart, sessionId]);

  useEffect(() => {
    if (!pendingAutostart || !connected) {
      return;
    }
    const text = pendingAutostart;
    setPendingAutostart(null);
    pushLine("user", text);
    sendPrompt(text);
  }, [connected, pendingAutostart, pushLine, sendPrompt]);

  useEffect(() => {
    void refreshPreview();
  }, [refreshPreview]);

  const statusLabel = useMemo(() => {
    if (status === "connected") {
      return "Connected";
    }
    if (status === "reconnecting") {
      return "Reconnecting…";
    }
    if (status === "connecting") {
      return "Connecting…";
    }
    return "Disconnected";
  }, [status]);

  const handleSend = () => {
    const text = prompt.trim();
    if (!text) {
      return;
    }
    if (!connected) {
      pushLine("system", "Not connected — reconnecting…");
      connect();
      return;
    }
    pushLine("user", text);
    if (!sendPrompt(text)) {
      pushLine("error", "Could not send — socket not ready.");
      connect();
      return;
    }
    setPrompt("");
  };

  const handleRebuildPreview = async () => {
    setPreviewStatus("building");
    pushLine("system", "Rebuilding preview…");
    if (connected) {
      buildPreview(true);
      return;
    }
    const meta = await rebuildProjectPreview(userId, projectId, true);
    if (meta?.status === "ready" && meta.preview_url) {
      setPreviewUrl(normalizePreviewUrl(meta.preview_url, userId, projectId));
      setPreviewStatus("ready");
    } else {
      setPreviewStatus(meta?.status || "failed");
      pushLine("error", meta?.preview_error || "Preview rebuild failed");
    }
  };

  return (
    <div className="agent-workspace">
      <header className="agent-workspace-header">
        <div>
          <h1>AI Coder — {projectName}</h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#9aa3b2" }}>
            {userId} / {agentProjectId}
          </p>
        </div>
        <div className="agent-status">
          <span
            className={`agent-status-dot ${status === "connected" ? "connected" : status === "reconnecting" ? "reconnecting" : ""}`}
          />
          {statusLabel}
          <button type="button" className="agent-btn ghost" onClick={() => connect()}>
            Reconnect
          </button>
        </div>
      </header>

      <div className="agent-workspace-main">
        <section className="agent-chat-panel">
          <div className="agent-chat-log">
            {lines.map((line) => (
              <div key={line.id} className={`agent-msg ${line.role}`}>
                {line.text}
              </div>
            ))}
          </div>
          <div className="agent-composer">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what to build or change…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="agent-composer-actions">
              <button
                type="button"
                className="agent-btn primary"
                onClick={handleSend}
                disabled={generating}
              >
                Send
              </button>
              <button
                type="button"
                className="agent-btn ghost"
                onClick={stopGeneration}
                disabled={!generating}
              >
                Stop
              </button>
              <button type="button" className="agent-btn ghost" onClick={() => void handleRebuildPreview()}>
                Rebuild preview
              </button>
            </div>
          </div>
        </section>

        <section className="agent-preview-panel">
          <div className="agent-preview-toolbar">
            <span>App preview ({previewStatus})</span>
            {previewUrl ? (
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Open in tab
              </a>
            ) : null}
          </div>
          {previewUrl ? (
            <iframe title="App preview" className="agent-preview-frame" src={previewUrl} />
          ) : (
            <div className="agent-preview-empty">
              Preview not ready. Run generation or click Rebuild preview.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
