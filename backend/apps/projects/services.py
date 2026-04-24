from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone
from django.utils.text import slugify
from strawberry.types import Info

from apps.accounts.models import AccountProfile
from apps.accounts.services import get_user_from_token
from apps.projects.models import (
    ActivityLog,
    IntegrationDefinition,
    File,
    Project,
    Storage,
    SubscriptionPlan,
    SupportTicket,
    TeamInvite,
    TeamMember,
    TicketAttachment,
    TicketReply,
    UserIntegration,
    UserSubscription,
)
from apps.projects.types import (
    AdminProfileType,
    ActivityLogType,
    CommentSummaryType,
    FileType,
    ProjectActivityType,
    ProjectArtifactType,
    ProjectDeploymentType,
    ProjectTaskType,
    ProjectType,
    StorageStatsType,
    StorageType,
    SubscriptionInfoType,
    SubscriptionPlanType,
    SupportTicketType,
    TeamInviteType,
    TeamOverviewType,
    TeamMemberType,
    TicketAttachmentType,
    TicketReplyType,
    UserSubscriptionType,
)
from apps.projects.integration_types import IntegrationDetailType, IntegrationSummaryType


def _extract_bearer_token(info: Info) -> str | None:
    request = getattr(info.context, "request", None)
    if request is None and isinstance(info.context, dict):
        request = info.context.get("request")

    if request is None:
        return None

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None

    return auth_header.split(" ", 1)[1].strip()


def get_authenticated_user(info: Info):
    token = _extract_bearer_token(info)
    if not token:
        return None
    return get_user_from_token(token)


def _to_timestamp_label(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M")


def get_or_create_storage_for_user(user) -> Storage:
    defaults = {
        "total_quota": 1024 * 1024 * 1024,
        "used_space": 0,
        "folder_name": f"storage/{user.username}",
    }
    storage, _ = Storage.objects.get_or_create(owner=user, defaults=defaults)
    return storage


def create_project_folder(storage: Storage, project_slug: str) -> str:
    folder = Path(storage.folder_name) / project_slug
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder).replace("\\", "/")


def recalculate_storage_usage(storage: Storage) -> None:
    used = (
        File.objects.filter(project__storage=storage, project__is_deleted=False).aggregate(total=models.Sum("file_size")).get("total")
        or 0
    )
    storage.used_space = used
    storage.save(update_fields=["used_space"])


def append_activity_log(
    project: Project,
    action_type: str,
    description: str,
    performed_by=None,
    metadata: dict | None = None,
) -> ActivityLog:
    log = ActivityLog.objects.create(
        project=project,
        performed_by=performed_by,
        action_type=action_type,
        description=description,
        metadata=metadata or None,
    )

    legacy = list(project.activity_json)
    legacy.insert(
        0,
        {
            "id": f"act-{uuid4().hex[:8]}",
            "text": description,
            "time": "Now",
            "actionType": action_type,
        },
    )
    project.activity_json = legacy
    project.save(update_fields=["activity_json", "updated_at"])
    return log


def _task_types(items: list[dict]) -> list[ProjectTaskType]:
    result: list[ProjectTaskType] = []
    for item in items:
        result.append(
            ProjectTaskType(
                id=str(item.get("id", "")),
                title=str(item.get("title", "")),
                assignee=str(item.get("assignee", "")),
                status=str(item.get("status", "todo")),
            )
        )
    return result


def _activity_types(items: list[dict]) -> list[ProjectActivityType]:
    result: list[ProjectActivityType] = []
    for item in items:
        result.append(
            ProjectActivityType(
                id=str(item.get("id", "")),
                text=str(item.get("text", "")),
                time=str(item.get("time", "")),
            )
        )
    return result


def _artifact_types(items: list[dict]) -> list[ProjectArtifactType]:
    result: list[ProjectArtifactType] = []
    for item in items:
        result.append(
            ProjectArtifactType(
                id=str(item.get("id", "")),
                name=str(item.get("name", "")),
                type=str(item.get("type", "spec")),
            )
        )
    return result


def _deployment_types(items: list[dict]) -> list[ProjectDeploymentType]:
    result: list[ProjectDeploymentType] = []
    for item in items:
        result.append(
            ProjectDeploymentType(
                id=str(item.get("id", "")),
                version=str(item.get("version", "")),
                status=str(item.get("status", "success")),
                deployed_at=str(item.get("deployedAt", "")),
            )
        )
    return result


def _team_member_types(items) -> list[TeamMemberType]:
    result: list[TeamMemberType] = []
    for item in items:
        user = item.user
        invited_by_name = None
        if item.invited_by:
            invited_by_name = item.invited_by.get_full_name() or item.invited_by.username
        result.append(
            TeamMemberType(
                id=str(item.id),
                user_id=str(user.id),
                username=user.username,
                display_name=user.get_full_name() or user.username,
                email=user.email or "",
                role=item.role,
                status=item.status,
                invited_by_id=str(item.invited_by_id) if item.invited_by_id else None,
                invited_by_name=invited_by_name,
                date_invited=_to_timestamp_label(item.date_invited),
                date_joined=_to_timestamp_label(item.date_joined) if item.date_joined else None,
            )
        )
    return result


def _file_types(items) -> list[FileType]:
    result: list[FileType] = []
    for item in items:
        uploader_name = "AI Agent"
        if item.uploaded_by:
            uploader_name = item.uploaded_by.get_full_name() or item.uploaded_by.username
        result.append(
            FileType(
                id=str(item.id),
                project_id=str(item.project_id),
                uploaded_by_id=str(item.uploaded_by_id) if item.uploaded_by_id else None,
                uploaded_by_name=uploader_name,
                file_name=item.file_name,
                file_path=item.file_path,
                file_size=item.file_size,
                file_type=item.file_type,
                uploaded_at=_to_timestamp_label(item.uploaded_at),
            )
        )
    return result


def _activity_log_types(items) -> list[ActivityLogType]:
    result: list[ActivityLogType] = []
    for item in items:
        actor = "AI Agent"
        if item.performed_by:
            actor = item.performed_by.get_full_name() or item.performed_by.username
        result.append(
            ActivityLogType(
                id=str(item.id),
                project_id=str(item.project_id),
                performed_by_id=str(item.performed_by_id) if item.performed_by_id else None,
                performed_by_name=actor,
                action_type=item.action_type,
                description=item.description,
                metadata=item.metadata,
                timestamp=_to_timestamp_label(item.timestamp),
            )
        )
    return result


def _storage_type(storage: Storage | None) -> StorageType | None:
    if storage is None:
        return None
    return StorageType(
        id=str(storage.id),
        total_quota=storage.total_quota,
        used_space=storage.used_space,
        folder_name=storage.folder_name,
        subscription_id=str(storage.subscription_id) if storage.subscription_id else None,
    )


def to_project_type(project: Project) -> ProjectType:
    owner_display = "Unknown"
    if project.owner:
        owner_display = project.owner.get_full_name() or project.owner.username

    project_storage = project.storage
    team_members = project.team_members.select_related("user", "invited_by").filter(status__in=[TeamMember.STATUS_PENDING, TeamMember.STATUS_ACTIVE])
    files = project.files.select_related("uploaded_by").all()

    return ProjectType(
        id=project.slug,
        slug=project.slug,
        name=project.name,
        owner=owner_display,
        owner_id=str(project.owner_id) if project.owner_id else None,
        description=project.description,
        state=project.state,
        updated_at=_to_timestamp_label(project.updated_at),
        created_at=_to_timestamp_label(project.created_at),
        is_deleted=project.is_deleted,
        folder_path=project.folder_path,
        used_storage=project.used_storage,
        storage=_storage_type(project_storage),
        tasks=_task_types(project.tasks_json),
        activity=_activity_types(project.activity_json),
        artifacts=_artifact_types(project.artifacts_json),
        comment_summary=CommentSummaryType(
            open=project.open_comments,
            approved=project.approved_comments,
            pushed=project.pushed_comments,
        ),
        deployments=_deployment_types(project.deployments_json),
        team_members=_team_member_types(team_members),
        files=_file_types(files),
    )


def _seed_owner(username: str):
    user_model = get_user_model()
    try:
        return user_model.objects.get(username=username)
    except user_model.DoesNotExist:
        return user_model.objects.order_by("id").first()


def ensure_seed_projects() -> None:
    seeds = [
        {
            "slug": "ai-agent-workspace",
            "name": "AI Agent Workspace",
            "owner": _seed_owner("ibrahim"),
            "description": "Core platform workspace for role-aware agent collaboration flows.",
            "state": Project.STATE_IN_REVIEW,
            "tasks_json": [
                {"id": "task-1", "title": "Validate dashboard handoff", "assignee": "Zahid", "status": "in_progress"},
                {"id": "task-2", "title": "Patch role-aware controls", "assignee": "Ismail", "status": "todo"},
            ],
            "activity_json": [
                {"id": "a1", "text": "QA comments were submitted for review", "time": "18m ago"},
                {"id": "a2", "text": "Agent run completed for sprint 4", "time": "42m ago"},
                {"id": "a3", "text": "Deployment checklist updated", "time": "1h ago"},
            ],
            "artifacts_json": [
                {"id": "ar1", "name": "requirements-v4.md", "type": "spec"},
                {"id": "ar2", "name": "dashboard.tsx", "type": "code"},
                {"id": "ar3", "name": "qa-checklist.md", "type": "test"},
            ],
            "open_comments": 5,
            "approved_comments": 2,
            "pushed_comments": 1,
            "deployments_json": [
                {"id": "d1", "version": "v0.6.0", "status": "success", "deployedAt": "2026-04-18 15:14"},
            ],
        },
        {
            "slug": "projects-module-foundation",
            "name": "Projects Module Foundation",
            "owner": _seed_owner("ismail"),
            "description": "Unified Projects workspace with list, view tabs, and action flow.",
            "state": Project.STATE_DRAFT,
            "tasks_json": [
                {"id": "task-3", "title": "Implement overview tab", "assignee": "Ismail", "status": "in_progress"},
                {"id": "task-4", "title": "Prepare deployment mock", "assignee": "Faizan", "status": "todo"},
            ],
            "activity_json": [
                {"id": "a4", "text": "Project draft initialized", "time": "30m ago"},
                {"id": "a5", "text": "Task board seeded", "time": "1h ago"},
            ],
            "artifacts_json": [
                {"id": "ar4", "name": "projects-plan.md", "type": "spec"},
                {"id": "ar5", "name": "project-shell.tsx", "type": "code"},
            ],
            "open_comments": 0,
            "approved_comments": 0,
            "pushed_comments": 0,
            "deployments_json": [],
        },
        {
            "slug": "support-workflow-revamp",
            "name": "Support Workflow Revamp",
            "owner": _seed_owner("ai_dev"),
            "description": "Refine support ticket triage and escalation visibility.",
            "state": Project.STATE_IN_PROGRESS,
            "tasks_json": [
                {"id": "task-5", "title": "Tag escalation priorities", "assignee": "AI_dev", "status": "in_progress"},
                {"id": "task-6", "title": "Audit ticket states", "assignee": "Ibrahim", "status": "todo"},
            ],
            "activity_json": [
                {"id": "a6", "text": "Support queue synced", "time": "58m ago"},
                {"id": "a7", "text": "Escalation matrix reviewed", "time": "2h ago"},
            ],
            "artifacts_json": [
                {"id": "ar6", "name": "ticket-routing.md", "type": "spec"},
                {"id": "ar7", "name": "support-state.json", "type": "design"},
            ],
            "open_comments": 2,
            "approved_comments": 1,
            "pushed_comments": 0,
            "deployments_json": [],
        },
        {
            "slug": "testing-and-qc-suite",
            "name": "Testing and QC Suite",
            "owner": _seed_owner("zahid"),
            "description": "Centralized testing and QA validation pipelines.",
            "state": Project.STATE_IN_REVIEW,
            "tasks_json": [
                {"id": "task-7", "title": "Validate regression notes", "assignee": "Zahid", "status": "in_progress"},
                {"id": "task-8", "title": "Finalize test report", "assignee": "Faizan", "status": "todo"},
            ],
            "activity_json": [
                {"id": "a8", "text": "Regression cycle completed", "time": "24m ago"},
                {"id": "a9", "text": "Review queue updated with QA comments", "time": "47m ago"},
            ],
            "artifacts_json": [
                {"id": "ar8", "name": "qa-regression-report.md", "type": "test"},
                {"id": "ar9", "name": "release-checklist.md", "type": "spec"},
            ],
            "open_comments": 4,
            "approved_comments": 1,
            "pushed_comments": 0,
            "deployments_json": [],
        },
    ]

    existing_slugs = set(Project.objects.values_list("slug", flat=True))

    for data in seeds:
        if data["slug"] in existing_slugs:
            continue
        owner = data.get("owner")
        if owner:
            storage = get_or_create_storage_for_user(owner)
            data["storage"] = storage
            data["folder_path"] = f"{storage.folder_name}/{data['slug']}"
            data["used_storage"] = 0
        Project.objects.create(**data)
        existing_slugs.add(data["slug"])


def find_project_or_none(project_id: str) -> Project | None:
    try:
        return Project.objects.select_related("owner", "storage").get(slug=project_id)
    except Project.DoesNotExist:
        return None


def append_activity(project: Project, text: str) -> None:
    activity = list(project.activity_json)
    activity.insert(0, {"id": f"act-{uuid4().hex[:8]}", "text": text, "time": "Now"})
    project.activity_json = activity


def user_by_id(user_id: str):
    model = get_user_model()
    try:
        return model.objects.get(id=user_id)
    except model.DoesNotExist:
        return None


def timeline_for_project(project: Project, action_type: str | None = None) -> list[ActivityLogType]:
    queryset = project.activity_logs.select_related("performed_by").all()
    if action_type:
        queryset = queryset.filter(action_type=action_type)
    return _activity_log_types(queryset.order_by("-timestamp"))


def file_list_for_project(project: Project) -> list[FileType]:
    return _file_types(project.files.select_related("uploaded_by").all())


def team_members_for_project(project: Project) -> list[TeamMemberType]:
    queryset = project.team_members.select_related("user", "invited_by").all()
    return _team_member_types(queryset)


def list_projects_for_owner(owner_id: str | None):
    queryset = Project.objects.select_related("owner", "storage")
    if owner_id:
        queryset = queryset.filter(owner_id=owner_id)
    return queryset.order_by("-updated_at")


def latest_project_for_user(user) -> Project | None:
    return Project.objects.filter(owner=user, is_deleted=False).order_by("-updated_at").first()


def _integration_state_for_user(user, integration: IntegrationDefinition) -> UserIntegration:
    state, _ = UserIntegration.objects.get_or_create(user=user, integration=integration)
    return state


def _mask_integration_config(config_fields: list[dict], config_data: dict | None) -> dict | None:
    if config_data is None:
        return None

    masked = dict(config_data)
    for field in config_fields:
        key = str(field.get("key", "")).strip()
        if not key:
            continue
        if str(field.get("type", "")).lower() == "password" and key in masked:
            masked[key] = "*****"
    return masked


def integration_summary_for_user(user) -> list[IntegrationSummaryType]:
    items = IntegrationDefinition.objects.filter(is_active=True).order_by("name")
    result: list[IntegrationSummaryType] = []
    for integration in items:
        state = UserIntegration.objects.filter(user=user, integration=integration).first()
        result.append(
            IntegrationSummaryType(
                id=str(integration.id),
                slug=integration.slug,
                name=integration.name,
                description=integration.description,
                category=integration.category,
                logo_key=integration.logo_key,
                is_active=integration.is_active,
                docs_url=integration.docs_url,
                config_fields=integration.config_fields,
                is_enabled=bool(state.is_enabled) if state else False,
                is_configured=bool(state.is_configured) if state else False,
                configured_at=_to_timestamp_label(state.configured_at) if state and state.configured_at else None,
                last_toggled_at=_to_timestamp_label(state.last_toggled_at) if state and state.last_toggled_at else None,
            )
        )
    return result


def integration_detail_for_user(user, slug: str) -> IntegrationDetailType | None:
    integration = IntegrationDefinition.objects.filter(slug=slug, is_active=True).first()
    if integration is None:
        return None

    state = UserIntegration.objects.filter(user=user, integration=integration).first()
    config_data = None
    if state and state.config_data is not None:
        config_data = _mask_integration_config(list(integration.config_fields), state.config_data)

    return IntegrationDetailType(
        id=str(integration.id),
        slug=integration.slug,
        name=integration.name,
        description=integration.description,
        category=integration.category,
        logo_key=integration.logo_key,
        is_active=integration.is_active,
        docs_url=integration.docs_url,
        config_fields=integration.config_fields,
        config_data=config_data,
        is_enabled=bool(state.is_enabled) if state else False,
        is_configured=bool(state.is_configured) if state else False,
        configured_at=_to_timestamp_label(state.configured_at) if state and state.configured_at else None,
        last_toggled_at=_to_timestamp_label(state.last_toggled_at) if state and state.last_toggled_at else None,
    )


def _merge_integration_config(integration: IntegrationDefinition, state: UserIntegration | None, config_data: dict) -> dict:
    merged = dict(state.config_data or {}) if state and state.config_data else {}
    merged.update(config_data)
    for field in list(integration.config_fields):
        key = str(field.get("key", "")).strip()
        if not key:
            continue
        field_type = str(field.get("type", "text")).lower()
        if field_type == "password" and merged.get(key) in {"", None, "*****"} and state and state.config_data and key in state.config_data:
            merged[key] = state.config_data[key]
        if "default" in field and key not in merged and field.get("default") is not None:
            merged[key] = field.get("default")
    return merged


def _validate_integration_config_fields(integration: IntegrationDefinition, config_data: dict) -> tuple[bool, str | None]:
    fields = list(integration.config_fields)
    for field in fields:
        key = str(field.get("key", "")).strip()
        if not key:
            continue
        required = bool(field.get("required"))
        field_type = str(field.get("type", "text")).lower()
        if required and key not in config_data:
            return False, f"{field.get('label', key)} is required."
        value = config_data.get(key)
        if required and (value is None or str(value).strip() == ""):
            return False, f"{field.get('label', key)} is required."
        if field_type == "select" and value not in field.get("options", []):
            return False, f"{field.get('label', key)} is invalid."
    return True, None


def configure_user_integration(user, slug: str, config_data: dict) -> tuple[IntegrationDetailType | None, str]:
    integration = IntegrationDefinition.objects.filter(slug=slug, is_active=True).first()
    if integration is None:
        return None, "Integration not found."

    state = UserIntegration.objects.filter(user=user, integration=integration).first()
    merged_config = _merge_integration_config(integration, state, config_data)
    valid, error = _validate_integration_config_fields(integration, merged_config)
    if not valid:
        return None, error or "Invalid configuration."

    state, _ = UserIntegration.objects.get_or_create(user=user, integration=integration)
    state.config_data = merged_config
    state.is_configured = True
    state.configured_at = timezone.now()
    state.save(update_fields=["config_data", "is_configured", "configured_at"])

    project = latest_project_for_user(user)
    if project is not None:
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_INTEGRATION_CONFIGURED,
            description=f"{integration.name} integration configured",
            performed_by=user,
            metadata={"integrationSlug": integration.slug},
        )

    return integration_detail_for_user(user, slug), "Integration configured."


def toggle_user_integration(user, slug: str, is_enabled: bool) -> tuple[IntegrationDetailType | None, str]:
    integration = IntegrationDefinition.objects.filter(slug=slug, is_active=True).first()
    if integration is None:
        return None, "Integration not found."

    state = UserIntegration.objects.filter(user=user, integration=integration).first()
    if is_enabled and (state is None or not state.is_configured):
        return None, "Please configure this integration before enabling it."

    if state is None:
        state = UserIntegration.objects.create(user=user, integration=integration)

    state.is_enabled = is_enabled
    state.last_toggled_at = timezone.now()
    state.save(update_fields=["is_enabled", "last_toggled_at"])

    project = latest_project_for_user(user)
    if project is not None:
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_INTEGRATION_TOGGLED,
            description=f"{integration.name} integration {'enabled' if is_enabled else 'disabled'}",
            performed_by=user,
            metadata={"integrationSlug": integration.slug, "isEnabled": is_enabled},
        )

    return integration_detail_for_user(user, slug), "Integration toggled."


def remove_user_integration(user, slug: str) -> tuple[bool, str]:
    integration = IntegrationDefinition.objects.filter(slug=slug, is_active=True).first()
    if integration is None:
        return False, "Integration not found."

    UserIntegration.objects.filter(user=user, integration=integration).delete()

    project = latest_project_for_user(user)
    if project is not None:
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_INTEGRATION_REMOVED,
            description=f"{integration.name} integration removed",
            performed_by=user,
            metadata={"integrationSlug": integration.slug},
        )

    return True, "Integration removed."


def ensure_storage_quota(storage: Storage, next_file_size: int) -> None:
    remaining = storage.total_quota - storage.used_space
    if next_file_size > remaining:
        raise ValueError("Storage quota exceeded.")


@transaction.atomic
def attach_file_to_project(project: Project, uploaded_by, file_name: str, file_path: str, file_size: int, file_type: str) -> File:
    if project.storage is None:
        if project.owner is None:
            raise ValueError("Project storage is not configured.")
        project.storage = get_or_create_storage_for_user(project.owner)
        project.save(update_fields=["storage", "updated_at"])

    ensure_storage_quota(project.storage, file_size)
    file_row = File.objects.create(
        project=project,
        uploaded_by=uploaded_by,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
        file_type=file_type,
    )

    project.used_storage = max(project.used_storage + file_size, 0)
    project.save(update_fields=["used_storage", "updated_at"])
    project.storage.used_space = max(project.storage.used_space + file_size, 0)
    project.storage.save(update_fields=["used_space"])
    return file_row


@transaction.atomic
def detach_file_from_project(file_row: File) -> Project:
    project = file_row.project
    storage = project.storage
    bytes_to_remove = file_row.file_size
    file_row.delete()

    project.used_storage = max(project.used_storage - bytes_to_remove, 0)
    project.save(update_fields=["used_storage", "updated_at"])
    if storage:
        storage.used_space = max(storage.used_space - bytes_to_remove, 0)
        storage.save(update_fields=["used_space"])
    return project


def make_slug(name: str) -> str:
    base = slugify(name) or "project"
    slug = base
    suffix = 2
    while Project.objects.filter(slug=slug).exists():
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug


def now_label() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def get_user_profile(user) -> AccountProfile | None:
    return AccountProfile.objects.filter(user=user).first()


def is_user_admin(user) -> bool:
    profile = get_user_profile(user)
    return bool(profile and profile.is_admin)


def ensure_default_subscription_plans() -> None:
    plan_rows = [
        {
            "name": SubscriptionPlan.NAME_FREE,
            "display_name": "Free",
            "storage_limit": 5 * 1024 * 1024 * 1024,
            "max_projects": 2,
            "max_team_members": 2,
            "price_display": "$0/mo",
        },
        {
            "name": SubscriptionPlan.NAME_BASIC,
            "display_name": "Basic",
            "storage_limit": 50 * 1024 * 1024 * 1024,
            "max_projects": 10,
            "max_team_members": 10,
            "price_display": "$19/mo",
        },
        {
            "name": SubscriptionPlan.NAME_PRO,
            "display_name": "Pro",
            "storage_limit": 250 * 1024 * 1024 * 1024,
            "max_projects": 50,
            "max_team_members": 40,
            "price_display": "$79/mo",
        },
        {
            "name": SubscriptionPlan.NAME_ENTERPRISE,
            "display_name": "Enterprise",
            "storage_limit": 1024 * 1024 * 1024 * 1024,
            "max_projects": 500,
            "max_team_members": 250,
            "price_display": "Contact sales",
        },
    ]
    for row in plan_rows:
        SubscriptionPlan.objects.update_or_create(name=row["name"], defaults=row)


def _plan_type(item: SubscriptionPlan) -> SubscriptionPlanType:
    return SubscriptionPlanType(
        id=str(item.id),
        name=item.name,
        display_name=item.display_name,
        storage_limit=item.storage_limit,
        max_projects=item.max_projects,
        max_team_members=item.max_team_members,
        price_display=item.price_display,
        is_active=item.is_active,
    )


def _subscription_type(item: UserSubscription) -> UserSubscriptionType:
    return UserSubscriptionType(
        id=str(item.id),
        user_id=str(item.user_id),
        plan=_plan_type(item.plan),
        status=item.status,
        started_at=_to_timestamp_label(item.started_at),
        current_period_end=_to_timestamp_label(item.current_period_end) if item.current_period_end else None,
    )


def storage_stats_for_user(user) -> StorageStatsType:
    ensure_default_subscription_plans()
    storage = get_or_create_storage_for_user(user)
    active_projects = Project.objects.filter(storage=storage, is_deleted=False).count()
    total_quota = max(storage.total_quota, 1)
    used_space = max(storage.used_space, 0)
    used_percent = round((used_space / total_quota) * 100, 2)
    return StorageStatsType(
        user_id=str(user.id),
        total_quota=storage.total_quota,
        used_space=storage.used_space,
        available_space=max(storage.total_quota - storage.used_space, 0),
        used_percent=used_percent,
        active_projects_count=active_projects,
    )


def get_or_create_user_subscription(user) -> UserSubscription:
    ensure_default_subscription_plans()
    free_plan = SubscriptionPlan.objects.filter(name=SubscriptionPlan.NAME_FREE).first()
    if free_plan is None:
        raise ValueError("Default subscription plan is unavailable.")

    sub, _ = UserSubscription.objects.select_related("plan").get_or_create(
        user=user,
        defaults={"plan": free_plan, "status": UserSubscription.STATUS_ACTIVE},
    )
    storage = get_or_create_storage_for_user(user)
    if sub.plan.storage_limit != storage.total_quota:
        storage.total_quota = sub.plan.storage_limit
        storage.save(update_fields=["total_quota"])
    if storage.subscription_id != sub.id:
        storage.subscription = sub
        storage.save(update_fields=["subscription"])
    return sub


def subscription_info_for_user(user) -> SubscriptionInfoType:
    subscription = get_or_create_user_subscription(user)
    plans = SubscriptionPlan.objects.filter(is_active=True).order_by("id")
    return SubscriptionInfoType(
        user_id=str(user.id),
        subscription=_subscription_type(subscription),
        plans=[_plan_type(item) for item in plans],
    )


def team_overview_for_admin(admin_user) -> TeamOverviewType:
    team_rows = TeamMember.objects.select_related("project", "user", "invited_by").filter(status=TeamMember.STATUS_ACTIVE)
    invite_rows = TeamInvite.objects.select_related("project", "invited_by").filter(status=TeamInvite.STATUS_PENDING)

    active_members = _team_member_types(team_rows)
    pending_invites: list[TeamInviteType] = []
    for row in invite_rows:
        inviter_name = None
        if row.invited_by:
            inviter_name = row.invited_by.get_full_name() or row.invited_by.username
        pending_invites.append(
            TeamInviteType(
                id=str(row.id),
                project_id=str(row.project_id),
                project_name=row.project.name,
                email=row.email,
                role=row.role,
                status=row.status,
                invited_by_id=str(row.invited_by_id) if row.invited_by_id else None,
                invited_by_name=inviter_name,
                date_invited=_to_timestamp_label(row.date_invited),
                expires_at=_to_timestamp_label(row.expires_at) if row.expires_at else None,
            )
        )

    return TeamOverviewType(
        admin_user_id=str(admin_user.id),
        active_members=active_members,
        pending_invites=pending_invites,
    )


def admin_profile_for_user(user) -> AdminProfileType:
    profile = get_user_profile(user)
    inviter_name = None
    if profile and profile.invited_by:
        inviter_name = profile.invited_by.get_full_name() or profile.invited_by.username
    return AdminProfileType(
        user_id=str(user.id),
        username=user.username,
        email=user.email or "",
        display_name=user.get_full_name() or user.username,
        is_admin=bool(profile and profile.is_admin),
        invited_by_id=str(profile.invited_by_id) if profile and profile.invited_by_id else None,
        invited_by_name=inviter_name,
    )


def _ticket_reply_type(item: TicketReply) -> TicketReplyType:
    author_name = "System"
    if item.author:
        author_name = item.author.get_full_name() or item.author.username
    return TicketReplyType(
        id=str(item.id),
        ticket_id=str(item.ticket_id),
        author_id=str(item.author_id) if item.author_id else None,
        author_name=author_name,
        message=item.message,
        is_internal_note=item.is_internal_note,
        created_at=_to_timestamp_label(item.created_at),
    )


def _ticket_attachment_type(item: TicketAttachment) -> TicketAttachmentType:
    uploaded_by_name = "System"
    if item.uploaded_by:
        uploaded_by_name = item.uploaded_by.get_full_name() or item.uploaded_by.username
    return TicketAttachmentType(
        id=str(item.id),
        file_name=item.file_name,
        file_path=item.file_path,
        file_size=item.file_size,
        file_type=item.file_type,
        uploaded_by_id=str(item.uploaded_by_id) if item.uploaded_by_id else None,
        uploaded_by_name=uploaded_by_name,
        created_at=_to_timestamp_label(item.created_at),
    )


def to_support_ticket_type(ticket: SupportTicket, *, include_internal: bool = False) -> SupportTicketType:
    raised_by_name = ticket.raised_by.get_full_name() or ticket.raised_by.username
    reply_qs = ticket.replies.select_related("author")
    if not include_internal:
        reply_qs = reply_qs.filter(is_internal_note=False)

    attachments_qs = ticket.attachments.select_related("uploaded_by").all()
    return SupportTicketType(
        id=str(ticket.id),
        ticket_number=ticket.ticket_number,
        raised_by_id=str(ticket.raised_by_id),
        raised_by_name=raised_by_name,
        subject=ticket.subject,
        category=ticket.category,
        priority=ticket.priority,
        status=ticket.status,
        description=ticket.description,
        linked_project_id=str(ticket.linked_project_id) if ticket.linked_project_id else None,
        linked_project_name=ticket.linked_project.name if ticket.linked_project_id else None,
        resolved_at=_to_timestamp_label(ticket.resolved_at) if ticket.resolved_at else None,
        created_at=_to_timestamp_label(ticket.created_at),
        updated_at=_to_timestamp_label(ticket.updated_at),
        replies=[_ticket_reply_type(item) for item in reply_qs],
        attachments=[_ticket_attachment_type(item) for item in attachments_qs],
    )


def _next_ticket_number() -> str:
    prefix = timezone.now().strftime("%Y")
    latest = SupportTicket.objects.filter(ticket_number__startswith=f"TKT-{prefix}-").order_by("-ticket_number").first()
    if latest is None:
        return f"TKT-{prefix}-0001"
    try:
        serial = int(latest.ticket_number.rsplit("-", 1)[-1]) + 1
    except ValueError:
        serial = 1
    return f"TKT-{prefix}-{serial:04d}"


def create_support_ticket(*, raised_by, subject: str, category: str, priority: str, description: str, linked_project=None) -> SupportTicket:
    return SupportTicket.objects.create(
        ticket_number=_next_ticket_number(),
        raised_by=raised_by,
        subject=subject,
        category=category,
        priority=priority,
        description=description,
        linked_project=linked_project,
    )
