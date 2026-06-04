"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { agentProjectKey } from "../../src/lib/agentClient";
import { AgentCoderWorkspace } from "../../src/modules/agent/components/AgentCoderWorkspace";

function AgentPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() || "";
  const projectName = searchParams.get("projectName")?.trim() || projectId || "Project";
  const sessionId = searchParams.get("session")?.trim() || agentProjectKey(projectId);
  const userId = searchParams.get("userId")?.trim() || undefined;
  const folderPath = searchParams.get("folderPath")?.trim() || "";
  const autostart = searchParams.get("autostart") === "1";

  if (!projectId) {
    return (
      <div style={{ padding: 24, color: "#e8eaed", background: "#0f1115", minHeight: "100vh" }}>
        <p>Missing <code>projectId</code> in the URL. Open this page from Projects → Open Agent Workspace.</p>
      </div>
    );
  }

  return (
    <AgentCoderWorkspace
      projectId={projectId}
      projectName={projectName}
      sessionId={sessionId}
      userId={userId}
      folderPath={folderPath}
      autostart={autostart}
    />
  );
}

export default function AgentPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: "#9aa3b2", background: "#0f1115", minHeight: "100vh" }}>
          Loading agent workspace…
        </div>
      }
    >
      <AgentPageContent />
    </Suspense>
  );
}
