from __future__ import annotations

import strawberry
from strawberry.scalars import JSON
from typing import NewType


BigInt = strawberry.scalar(
    NewType("BigInt", int),
    name="BigInt",
    description="Arbitrary-size integer for byte counts and quotas.",
    serialize=lambda value: int(value),
    parse_value=lambda value: int(value),
)


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
class StorageType:
    id: strawberry.ID
    total_quota: BigInt
    used_space: BigInt
    folder_name: str
    subscription_id: strawberry.ID | None


@strawberry.type
class TeamMemberType:
    id: strawberry.ID
    user_id: strawberry.ID
    username: str
    display_name: str
    email: str
    role: str
    status: str
    invited_by_id: strawberry.ID | None
    invited_by_name: str | None
    date_invited: str
    date_joined: str | None


@strawberry.type
class FileType:
    id: strawberry.ID
    project_id: strawberry.ID
    uploaded_by_id: strawberry.ID | None
    uploaded_by_name: str
    file_name: str
    file_path: str
    file_size: BigInt
    file_type: str
    uploaded_at: str


@strawberry.type
class ActivityLogType:
    id: strawberry.ID
    project_id: strawberry.ID
    performed_by_id: strawberry.ID | None
    performed_by_name: str
    action_type: str
    description: str
    metadata: JSON | None
    timestamp: str


@strawberry.type
class CommentSummaryType:
    open: int
    approved: int
    pushed: int


@strawberry.type
class ProjectType:
    id: strawberry.ID
    slug: str
    name: str
    owner: str
    owner_id: strawberry.ID | None
    description: str
    state: str
    updated_at: str
    created_at: str
    is_deleted: bool
    folder_path: str
    used_storage: BigInt
    storage: StorageType | None
    tasks: list[ProjectTaskType]
    activity: list[ProjectActivityType]
    artifacts: list[ProjectArtifactType]
    comment_summary: CommentSummaryType
    deployments: list[ProjectDeploymentType]
    team_members: list[TeamMemberType]
    files: list[FileType]


@strawberry.type
class ProjectMutationPayload:
    success: bool
    message: str
    project: ProjectType | None


@strawberry.input
class CreateProjectInput:
    name: str
    description: str | None = None
    owner_id: strawberry.ID | None = None


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


@strawberry.input
class UpdateProjectInput:
    project_id: strawberry.ID
    name: str | None = None
    description: str | None = None
    status: str | None = None


@strawberry.input
class AssignTeamMemberInput:
    project_id: strawberry.ID
    user_id: strawberry.ID
    role: str


@strawberry.input
class RemoveTeamMemberInput:
    project_id: strawberry.ID
    user_id: strawberry.ID


@strawberry.input
class UploadFileInput:
    project_id: strawberry.ID
    uploaded_by_id: strawberry.ID
    file_name: str
    file_path: str
    file_size: BigInt
    file_type: str


@strawberry.input
class DeleteFileInput:
    file_id: strawberry.ID


@strawberry.type
class TeamMemberMutationPayload:
    success: bool
    message: str
    member: TeamMemberType | None


@strawberry.type
class FileMutationPayload:
    success: bool
    message: str
    file: FileType | None
    project: ProjectType | None


@strawberry.type
class SubscriptionPlanType:
    id: strawberry.ID
    name: str
    display_name: str
    storage_limit: BigInt
    max_projects: int
    max_team_members: int
    price_display: str
    is_active: bool


@strawberry.type
class UserSubscriptionType:
    id: strawberry.ID
    user_id: strawberry.ID
    plan: SubscriptionPlanType
    status: str
    started_at: str
    current_period_end: str | None


@strawberry.type
class StorageStatsType:
    user_id: strawberry.ID
    total_quota: BigInt
    used_space: BigInt
    available_space: BigInt
    used_percent: float
    active_projects_count: int


@strawberry.type
class SubscriptionInfoType:
    user_id: strawberry.ID
    subscription: UserSubscriptionType | None
    plans: list[SubscriptionPlanType]


@strawberry.type
class TeamInviteType:
    id: strawberry.ID
    project_id: strawberry.ID
    project_name: str
    email: str
    role: str
    status: str
    invited_by_id: strawberry.ID | None
    invited_by_name: str | None
    date_invited: str
    expires_at: str | None


@strawberry.type
class TeamOverviewType:
    admin_user_id: strawberry.ID
    active_members: list[TeamMemberType]
    pending_invites: list[TeamInviteType]


@strawberry.type
class AdminProfileType:
    user_id: strawberry.ID
    username: str
    email: str
    display_name: str
    is_admin: bool
    invited_by_id: strawberry.ID | None
    invited_by_name: str | None


@strawberry.type
class TicketAttachmentType:
    id: strawberry.ID
    file_name: str
    file_path: str
    file_size: BigInt
    file_type: str
    uploaded_by_id: strawberry.ID | None
    uploaded_by_name: str
    created_at: str


@strawberry.type
class TicketReplyType:
    id: strawberry.ID
    ticket_id: strawberry.ID
    author_id: strawberry.ID | None
    author_name: str
    message: str
    is_internal_note: bool
    created_at: str


@strawberry.type
class SupportTicketType:
    id: strawberry.ID
    ticket_number: str
    raised_by_id: strawberry.ID
    raised_by_name: str
    subject: str
    category: str
    priority: str
    status: str
    description: str
    linked_project_id: strawberry.ID | None
    linked_project_name: str | None
    resolved_at: str | None
    created_at: str
    updated_at: str
    replies: list[TicketReplyType]
    attachments: list[TicketAttachmentType]


@strawberry.type
class SupportTicketMutationPayload:
    success: bool
    message: str
    ticket: SupportTicketType | None


@strawberry.type
class SelectPlanPayload:
    success: bool
    message: str
    subscription: UserSubscriptionType | None


@strawberry.input
class SelectPlanInput:
    user_id: strawberry.ID
    plan_id: strawberry.ID


@strawberry.input
class CreateSupportTicketInput:
    subject: str
    category: str
    priority: str
    description: str
    linked_project_id: strawberry.ID | None = None


@strawberry.input
class ReplySupportTicketInput:
    ticket_id: strawberry.ID
    message: str
    is_internal_note: bool = False


@strawberry.input
class UpdateTicketStatusInput:
    ticket_id: strawberry.ID
    status: str


@strawberry.input
class UpdateTicketPriorityInput:
    ticket_id: strawberry.ID
    priority: str


@strawberry.input
class UploadTicketAttachmentInput:
    ticket_id: strawberry.ID
    file_name: str
    file_path: str
    file_size: BigInt
    file_type: str


