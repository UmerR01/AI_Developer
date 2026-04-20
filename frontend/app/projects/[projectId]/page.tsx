"use client";

import { useParams } from "next/navigation";

import { ProjectsPageShell } from "../../../src/modules/projects/components/ProjectsPageShell";

export default function ProjectDetailsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId ?? undefined;

  return <ProjectsPageShell selectedProjectId={projectId} />;
}
