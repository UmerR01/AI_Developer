"use client";

import { Montserrat } from "next/font/google";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { AgentWorkspaceEmbed } from "../../../../src/modules/agent-workspace/AgentWorkspaceEmbed";
import { buildAgentWorkspaceIframeUrl } from "../../../../src/modules/agent-workspace/utils";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function ProjectAgentWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.projectId ?? "";
  const projectName = searchParams.get("projectName") ?? "";
  const sessionId = searchParams.get("session") ?? (projectId ? `project-${projectId}` : "");
  const autostart = searchParams.get("autostart") === "1";

  const iframeSrc = useMemo(() => {
    if (!projectId) {
      return "";
    }
    return buildAgentWorkspaceIframeUrl({
      projectId,
      projectName: projectName || undefined,
      sessionId,
      autostart,
    });
  }, [autostart, projectId, projectName, sessionId]);

  return (
    <div className={montserrat.className}>
      <AgentWorkspaceEmbed src={iframeSrc} />
    </div>
  );
}
