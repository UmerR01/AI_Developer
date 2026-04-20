from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from strawberry.types import Info

from apps.accounts.services import get_user_from_token
from apps.projects.models import Project
from apps.projects.types import (
    CommentSummaryType,
    ProjectActivityType,
    ProjectArtifactType,
    ProjectDeploymentType,
    ProjectTaskType,
    ProjectType,
)


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


def to_project_type(project: Project) -> ProjectType:
    owner_display = "Unknown"
    if project.owner:
        owner_display = project.owner.get_full_name() or project.owner.username

    return ProjectType(
        id=project.slug,
        name=project.name,
        owner=owner_display,
        description=project.description,
        state=project.state,
        updated_at=_to_timestamp_label(project.updated_at),
        tasks=_task_types(project.tasks_json),
        activity=_activity_types(project.activity_json),
        artifacts=_artifact_types(project.artifacts_json),
        comment_summary=CommentSummaryType(
            open=project.open_comments,
            approved=project.approved_comments,
            pushed=project.pushed_comments,
        ),
        deployments=_deployment_types(project.deployments_json),
    )


def _seed_owner(username: str):
    user_model = get_user_model()
    try:
        return user_model.objects.get(username=username)
    except user_model.DoesNotExist:
        return user_model.objects.order_by("id").first()


def ensure_seed_projects() -> None:
    if Project.objects.exists():
        return

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
    ]

    for data in seeds:
        Project.objects.create(**data)


def find_project_or_none(project_id: str) -> Project | None:
    try:
        return Project.objects.get(slug=project_id)
    except Project.DoesNotExist:
        return None


def append_activity(project: Project, text: str) -> None:
    activity = list(project.activity_json)
    activity.insert(0, {"id": f"act-{uuid4().hex[:8]}", "text": text, "time": "Now"})
    project.activity_json = activity


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
