"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "./agent-workspace.css";

interface AgentWorkspaceEmbedProps {
  src: string;
}

// ── Token helpers ─────────────────────────────────────────────────────────────
const COMPACT_THRESHOLD = parseInt(
  process.env.NEXT_PUBLIC_CONTEXT_COMPACT_THRESHOLD ?? "100000",
  10,
);

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// Parse WS URL and session params out of the iframe src
function parseWsParams(src: string): {
  wsUrl: string;
  apiUrl: string;
  sessionId: string;
  userId: string;
  projectId: string;
} | null {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : undefined;
    const u = new URL(src, base);
    const ws = u.searchParams.get("ws");
    const sessionId = u.searchParams.get("session") ?? "";
    const userId = u.searchParams.get("userId") ?? "default";
    const projectId = u.searchParams.get("projectId") ?? "";
    if (!ws || !sessionId) return null;
    
    // Append query params the server expects
    const fullWs = `${ws}?session=${encodeURIComponent(sessionId)}&userId=${encodeURIComponent(userId)}&projectId=${encodeURIComponent(projectId)}`;
    
    // API endpoint for tokens
    const apiUrl = `${u.origin}/api/projects/${encodeURIComponent(userId)}/${encodeURIComponent(projectId)}/context/tokens?session_id=${encodeURIComponent(sessionId)}`;
    
    return { wsUrl: fullWs, apiUrl, sessionId, userId, projectId };
  } catch {
    return null;
  }
}

// ── Token badge overlay ───────────────────────────────────────────────────────
function TokenBadge({ src }: { src: string }) {
  const [tokens, setTokens] = useState(0);
  const [compactThreshold, setCompactThreshold] = useState(100000);
  const [isCompacted, setIsCompacted] = useState(false);
  const [compactReason, setCompactReason] = useState<"threshold" | "rate_limit" | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInitialTokens = useCallback(async (apiUrl: string) => {
    try {
      const resp = await fetch(apiUrl);
      if (resp.ok) {
        const data = await resp.json();
        if (data && typeof data.tokens_estimated === "number") {
          setTokens(data.tokens_estimated);
        }
        if (data && typeof data.threshold === "number") {
          setCompactThreshold(data.threshold);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch initial tokens:", err);
    }
  }, []);

  const connect = useCallback(() => {
    const params = parseWsParams(src);
    if (!params) return;

    // Fetch current tokens on connect/reconnect
    fetchInitialTokens(params.apiUrl);

    const ws = new WebSocket(params.wsUrl);
    wsRef.current = ws;
    setWsState("connecting");

    ws.onopen = () => setWsState("connected");

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        const type = msg["type"] as string | undefined;

        if (type === "run_complete") {
          const t = msg["tokens_estimated"] as number | undefined;
          if (t !== undefined) setTokens(t);
        }

        if (type === "context_compacted") {
          const t = msg["tokens_after"] as number | undefined;
          const reason = msg["reason"] as string | undefined;
          if (t !== undefined) setTokens(t);
          setIsCompacted(true);
          setCompactReason(reason === "429_rate_limit" ? "rate_limit" : "threshold");
        }

        if (type === "workspace_ready") {
          setWsState("connected");
          // Refresh tokens on ready too
          fetchInitialTokens(params.apiUrl);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setWsState("disconnected");
      // auto-reconnect after 4 s
      reconnectTimer.current = setTimeout(() => connect(), 4000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [src, fetchInitialTokens]);

  useEffect(() => {
    if (!src) return;
    connect();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [src, connect]);

  const pct = Math.min(100, Math.round((tokens / compactThreshold) * 100));
  const isHigh = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div className="aw-token-overlay">
      {/* Token counter pill */}
      <div
        className={`aw-token-pill ${isCritical ? "aw-critical" : isHigh ? "aw-high" : ""}`}
        title={`Chat history: ${tokens.toLocaleString()} / ${compactThreshold.toLocaleString()} tokens (${pct}%)`}
      >
        {/* WS dot */}
        <span
          className={`aw-dot ${wsState === "connected" ? "aw-dot-ok" : wsState === "connecting" ? "aw-dot-warn" : "aw-dot-err"}`}
        />

        {/* Bar */}
        <span className="aw-bar-wrap" aria-hidden>
          <span className="aw-bar-fill" style={{ width: `${pct}%` }} />
        </span>

        {/* Label */}
        <span className="aw-token-label">
          {fmtTokens(tokens)}
          <span className="aw-token-sep">/</span>
          {fmtTokens(compactThreshold)}
          <span className="aw-token-pct">({pct}%)</span>
        </span>
      </div>

      {/* Compaction badge (only shown after compaction) */}
      {isCompacted && (
        <div
          className={`aw-compact-badge ${compactReason === "rate_limit" ? "aw-compact-rate" : "aw-compact-ok"}`}
          title={
            compactReason === "rate_limit"
              ? "Context was compacted automatically due to a rate limit (429)."
              : "Context was compacted automatically at token budget limit."
          }
        >
          {compactReason === "rate_limit" ? "⚡ Rate limit — compacted" : "✓ Context compacted"}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AgentWorkspaceEmbed({ src }: AgentWorkspaceEmbedProps) {
  if (!src) {
    return (
      <div className="agent-workspace-shell">
        <div className="agent-workspace-empty">Missing project id for the AI workspace.</div>
      </div>
    );
  }

  return (
    <div className="agent-workspace-shell">
      {/* Token badge overlay (sits above the iframe) */}
      <TokenBadge src={src} />

      {/* The original iframe – unchanged */}
      <iframe
        className="agent-workspace-frame"
        src={src}
        title="AI Coder Workspace"
        allow="clipboard-write"
      />
    </div>
  );
}
