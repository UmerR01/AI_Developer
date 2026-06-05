"use client";

import "./agent-workspace.css";

interface AgentWorkspaceEmbedProps {
  src: string;
}

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
      <iframe
        className="agent-workspace-frame"
        src={src}
        title="AI Coder Workspace"
        allow="clipboard-write"
      />
    </div>
  );
}
