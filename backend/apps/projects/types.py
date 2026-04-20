from __future__ import annotations

import strawberry


@strawberry.type
class ProjectTaskType:
    id: str
    title: str
    assignee: str
    status: str


@strawberry.type
class ProjectActivityType:
    id: str
    text: str
    time: str


@strawberry.type
class ProjectArtifactType:
    id: str
    name: str
    type: str


@strawberry.type
class ProjectDeploymentType:
    id: str
    version: str
    status: str
    deployed_at: str


@strawberry.type
class CommentSummaryType:
    open: int
    approved: int
    pushed: int


@strawberry.type
class ProjectType:
    id: strawberry.ID
    name: str
    owner: str
    description: str
    state: str
    updated_at: str
    tasks: list[ProjectTaskType]
    activity: list[ProjectActivityType]
    artifacts: list[ProjectArtifactType]
    comment_summary: CommentSummaryType
    deployments: list[ProjectDeploymentType]


@strawberry.type
class ProjectMutationPayload:
    success: bool
    message: str
    project: ProjectType | None


@strawberry.input
class CreateProjectInput:
    name: str
    description: str | None = None


@strawberry.input
class AddProjectCommentInput:
    project_id: strawberry.ID
    comment: str


@strawberry.input
class ProjectActionInput:
    project_id: strawberry.ID


@strawberry.input
class DeployProjectInput:
    project_id: strawberry.ID
    version_label: str | None = None
