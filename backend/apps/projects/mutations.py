from __future__ import annotations

from uuid import uuid4

import strawberry
from django.db import transaction

from apps.projects.models import Project
from apps.projects.services import (
    append_activity,
    ensure_seed_projects,
    find_project_or_none,
    get_authenticated_user,
    make_slug,
    now_label,
    to_project_type,
)
from apps.projects.types import (
    AddProjectCommentInput,
    CreateProjectInput,
    DeployProjectInput,
    ProjectActionInput,
    ProjectMutationPayload,
)


@strawberry.type
class ProjectMutation:
    @strawberry.mutation
    def create_project(self, info: strawberry.Info, input: CreateProjectInput) -> ProjectMutationPayload:
        user = get_authenticated_user(info)
        if user is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        name = input.name.strip()
        if not name:
            return ProjectMutationPayload(success=False, message="Project name is required.", project=None)

        with transaction.atomic():
            project = Project.objects.create(
                slug=make_slug(name),
                name=name,
                description=(input.description or "").strip(),
                owner=user,
                state=Project.STATE_DRAFT,
                tasks_json=[],
                artifacts_json=[],
                deployments_json=[],
            )
            append_activity(project, "Project created in Draft state")
            project.save(update_fields=["activity_json", "updated_at"])

        return ProjectMutationPayload(success=True, message="Project created.", project=to_project_type(project))

    @strawberry.mutation
    def start_agent_run(self, info: strawberry.Info, input: ProjectActionInput) -> ProjectMutationPayload:
        user = get_authenticated_user(info)
        if user is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        project.state = Project.STATE_IN_PROGRESS
        append_activity(project, "Agent run started from Projects workspace")
        project.save(update_fields=["state", "activity_json", "updated_at"])
        return ProjectMutationPayload(success=True, message="Agent run started.", project=to_project_type(project))

    @strawberry.mutation
    def add_project_comment(self, info: strawberry.Info, input: AddProjectCommentInput) -> ProjectMutationPayload:
        user = get_authenticated_user(info)
        if user is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        comment_text = input.comment.strip()
        if not comment_text:
            return ProjectMutationPayload(success=False, message="Comment text is required.", project=None)

        project.open_comments += 1
        append_activity(project, "Comment added to review queue")
        project.save(update_fields=["open_comments", "activity_json", "updated_at"])

        return ProjectMutationPayload(success=True, message="Comment added.", project=to_project_type(project))

    @strawberry.mutation
    def review_and_push_comments(self, info: strawberry.Info, input: ProjectActionInput) -> ProjectMutationPayload:
        user = get_authenticated_user(info)
        if user is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        if project.open_comments == 0:
            return ProjectMutationPayload(success=False, message="No open comments to push.", project=to_project_type(project))

        project.approved_comments += project.open_comments
        project.pushed_comments += project.open_comments
        project.open_comments = 0
        project.state = Project.STATE_REVISING
        append_activity(project, "Approved comments pushed to agent")
        project.save(
            update_fields=[
                "approved_comments",
                "pushed_comments",
                "open_comments",
                "state",
                "activity_json",
                "updated_at",
            ]
        )

        return ProjectMutationPayload(success=True, message="Comments pushed to agent.", project=to_project_type(project))

    @strawberry.mutation
    def deploy_project(self, info: strawberry.Info, input: DeployProjectInput) -> ProjectMutationPayload:
        user = get_authenticated_user(info)
        if user is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        deployments = list(project.deployments_json)
        next_version = input.version_label.strip() if input.version_label else f"v0.{len(deployments) + 7}.0"
        deployments.insert(
            0,
            {
                "id": f"deploy-{uuid4().hex[:8]}",
                "version": next_version,
                "status": "success",
                "deployedAt": now_label(),
            },
        )

        project.state = Project.STATE_LIVE
        project.deployments_json = deployments
        append_activity(project, "Project deployed to Live")
        project.save(update_fields=["state", "deployments_json", "activity_json", "updated_at"])

        return ProjectMutationPayload(success=True, message="Project deployed.", project=to_project_type(project))

    @strawberry.mutation
    def rollback_project(self, info: strawberry.Info, input: ProjectActionInput) -> ProjectMutationPayload:
        user = get_authenticated_user(info)
        if user is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        deployments = list(project.deployments_json)
        if not deployments:
            return ProjectMutationPayload(success=False, message="No deployment history to roll back.", project=to_project_type(project))

        last_version = str(deployments[0].get("version", "v0.0.0"))
        deployments.insert(
            0,
            {
                "id": f"rollback-{uuid4().hex[:8]}",
                "version": last_version,
                "status": "rollback",
                "deployedAt": now_label(),
            },
        )

        project.state = Project.STATE_IN_REVIEW
        project.deployments_json = deployments
        append_activity(project, "Rollback executed to previous stable version")
        project.save(update_fields=["state", "deployments_json", "activity_json", "updated_at"])

        return ProjectMutationPayload(success=True, message="Rollback completed.", project=to_project_type(project))
