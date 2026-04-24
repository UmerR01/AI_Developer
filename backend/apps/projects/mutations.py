from __future__ import annotations

from django.db import transaction
from django.utils import timezone
import strawberry

from apps.projects.models import ActivityLog, File, Project, SubscriptionPlan, SupportTicket, TeamMember, TicketAttachment, TicketReply
from apps.projects.services import (
    create_support_ticket,
    append_activity,
    append_activity_log,
    admin_profile_for_user,
    attach_file_to_project,
    create_project_folder,
    ensure_seed_projects,
    configure_user_integration,
    find_project_or_none,
    get_authenticated_user,
    get_or_create_user_subscription,
    get_or_create_storage_for_user,
    remove_user_integration,
    is_user_admin,
    make_slug,
    now_label,
    subscription_info_for_user,
    to_support_ticket_type,
    to_project_type,
    toggle_user_integration,
    user_by_id,
)
from apps.projects.types import (
    AddProjectCommentInput,
    AssignTeamMemberInput,
    CreateProjectInput,
    DeleteFileInput,
    DeployProjectInput,
    FileMutationPayload,
    CreateSupportTicketInput,
    ProjectActionInput,
    ProjectMutationPayload,
    ReplySupportTicketInput,
    RemoveTeamMemberInput,
    SelectPlanInput,
    SelectPlanPayload,
    SupportTicketMutationPayload,
    TeamMemberMutationPayload,
    UpdateTicketPriorityInput,
    UpdateTicketStatusInput,
    UpdateProjectInput,
    UploadTicketAttachmentInput,
    UploadFileInput,
)
from apps.projects.integration_types import (
    ConfigureIntegrationInput,
    IntegrationMutationPayload,
    IntegrationRemovalPayload,
    RemoveIntegrationInput,
    ToggleIntegrationInput,
)


def _state_from_status(status: str | None) -> str | None:
    if status is None:
        return None
    normalized = status.strip().lower().replace("_", " ")
    if normalized in {"draft"}:
        return Project.STATE_DRAFT
    if normalized in {"in progress", "active"}:
        return Project.STATE_IN_PROGRESS
    if normalized in {"completed", "live"}:
        return Project.STATE_LIVE
    if normalized in {"in review"}:
        return Project.STATE_IN_REVIEW
    return None


def _team_member_to_payload(member: TeamMember) -> TeamMemberMutationPayload:
    from apps.projects.services import team_members_for_project

    items = team_members_for_project(member.project)
    selected = next((item for item in items if str(item.id) == str(member.id)), None)
    return TeamMemberMutationPayload(success=True, message="Success", member=selected)


@strawberry.type
class ProjectMutation:
    @strawberry.mutation
    def select_plan(self, info: strawberry.Info, input: SelectPlanInput) -> SelectPlanPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return SelectPlanPayload(success=False, message="Authentication required.", subscription=None)

        target_user = user_by_id(str(input.user_id))
        if target_user is None:
            return SelectPlanPayload(success=False, message="User not found.", subscription=None)
        if str(actor.id) != str(target_user.id) and not is_user_admin(actor):
            return SelectPlanPayload(success=False, message="Not authorized.", subscription=None)

        subscription = get_or_create_user_subscription(target_user)
        plan = SubscriptionPlan.objects.filter(id=str(input.plan_id), is_active=True).first()
        if plan is None:
            return SelectPlanPayload(success=False, message="Plan not found.", subscription=None)

        subscription.plan = plan
        subscription.status = subscription.STATUS_ACTIVE
        subscription.current_period_end = None
        subscription.save(update_fields=["plan", "status", "current_period_end"])

        storage = get_or_create_storage_for_user(target_user)
        storage.subscription = subscription
        storage.total_quota = plan.storage_limit
        storage.save(update_fields=["subscription", "total_quota"])

        # TODO: Replace with payment gateway workflow and webhook reconciliation.
        if storage.used_space > storage.total_quota:
            storage.used_space = storage.total_quota
            storage.save(update_fields=["used_space"])

        owner_project = Project.objects.filter(owner=target_user, is_deleted=False).order_by("-updated_at").first()
        if owner_project is not None:
            append_activity_log(
                project=owner_project,
                action_type=ActivityLog.ACTION_STATUS_CHANGED,
                description=f"Subscription plan switched to {plan.display_name}.",
                performed_by=actor,
                metadata={"planId": str(plan.id), "planName": plan.name},
            )

        profile = admin_profile_for_user(target_user)
        return SelectPlanPayload(
            success=True,
            message=f"Plan updated to {plan.display_name} for {profile.username}.",
            subscription=subscription_info_for_user(target_user).subscription,
        )

    @strawberry.mutation
    def create_project(self, info: strawberry.Info, input: CreateProjectInput) -> ProjectMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        name = input.name.strip()
        if not name:
            return ProjectMutationPayload(success=False, message="Project name is required.", project=None)

        owner = actor
        if input.owner_id:
            owner_candidate = user_by_id(str(input.owner_id))
            if owner_candidate is None:
                return ProjectMutationPayload(success=False, message="Owner not found.", project=None)
            owner = owner_candidate

        try:
            with transaction.atomic():
                storage = get_or_create_storage_for_user(owner)
                slug = make_slug(name)
                folder_path = create_project_folder(storage, slug)

                project = Project.objects.create(
                    slug=slug,
                    name=name,
                    description=(input.description or "").strip(),
                    owner=owner,
                    storage=storage,
                    folder_path=folder_path,
                    state=Project.STATE_DRAFT,
                    tasks_json=[],
                    artifacts_json=[],
                    deployments_json=[],
                    used_storage=0,
                )
                append_activity(project, "Project created in Draft state")
                project.save(update_fields=["activity_json", "updated_at"])
                append_activity_log(
                    project=project,
                    action_type=ActivityLog.ACTION_PROJECT_CREATED,
                    description=f"Project '{project.name}' created.",
                    performed_by=actor,
                    metadata={"projectSlug": project.slug},
                )
        except Exception as exc:
            return ProjectMutationPayload(success=False, message=str(exc), project=None)

        return ProjectMutationPayload(success=True, message="Project created.", project=to_project_type(project))

    @strawberry.mutation
    def update_project(self, info: strawberry.Info, input: UpdateProjectInput) -> ProjectMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        updates: list[str] = []
        if input.name is not None:
            cleaned = input.name.strip()
            if cleaned:
                project.name = cleaned
                updates.append("name")
        if input.description is not None:
            project.description = input.description.strip()
            updates.append("description")
        if input.status is not None:
            next_state = _state_from_status(input.status)
            if next_state is None:
                return ProjectMutationPayload(success=False, message="Invalid status value.", project=None)
            previous = project.state
            project.state = next_state
            updates.append("state")
            append_activity_log(
                project=project,
                action_type=ActivityLog.ACTION_STATUS_CHANGED,
                description=f"Status changed from {previous} to {next_state}.",
                performed_by=actor,
                metadata={"oldStatus": previous, "newStatus": next_state},
            )

        if updates:
            project.save(update_fields=[*set(updates), "updated_at"])
            append_activity_log(
                project=project,
                action_type=ActivityLog.ACTION_PROJECT_UPDATED,
                description=f"Project '{project.name}' updated.",
                performed_by=actor,
                metadata={"fields": list(set(updates))},
            )

        return ProjectMutationPayload(success=True, message="Project updated.", project=to_project_type(project))

    @strawberry.mutation
    def delete_project(self, info: strawberry.Info, input: ProjectActionInput) -> ProjectMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        ensure_seed_projects()
        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        project.is_deleted = True
        project.save(update_fields=["is_deleted", "updated_at"])
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_PROJECT_UPDATED,
            description=f"Project '{project.name}' archived.",
            performed_by=actor,
            metadata={"isDeleted": True},
        )

        return ProjectMutationPayload(success=True, message="Project archived.", project=to_project_type(project))

    @strawberry.mutation
    def restore_project(self, info: strawberry.Info, input: ProjectActionInput) -> ProjectMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return ProjectMutationPayload(success=False, message="Authentication required.", project=None)

        project = find_project_or_none(str(input.project_id))
        if project is None:
            return ProjectMutationPayload(success=False, message="Project not found.", project=None)

        project.is_deleted = False
        project.save(update_fields=["is_deleted", "updated_at"])
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_PROJECT_UPDATED,
            description=f"Project '{project.name}' restored.",
            performed_by=actor,
            metadata={"isDeleted": False},
        )

        return ProjectMutationPayload(success=True, message="Project restored.", project=to_project_type(project))

    @strawberry.mutation
    def assign_team_member(self, info: strawberry.Info, input: AssignTeamMemberInput) -> TeamMemberMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return TeamMemberMutationPayload(success=False, message="Authentication required.", member=None)

        project = find_project_or_none(str(input.project_id))
        if project is None:
            return TeamMemberMutationPayload(success=False, message="Project not found.", member=None)

        user = user_by_id(str(input.user_id))
        if user is None:
            return TeamMemberMutationPayload(success=False, message="User not found.", member=None)

        role = input.role.strip().lower()
        if role not in {TeamMember.ROLE_DEVELOPER, TeamMember.ROLE_QA}:
            return TeamMemberMutationPayload(success=False, message="Role must be developer or qa.", member=None)

        membership, _created = TeamMember.objects.get_or_create(
            project=project,
            user=user,
            defaults={"role": role, "invited_by": actor, "status": TeamMember.STATUS_PENDING},
        )
        membership.role = role
        membership.invited_by = actor
        if membership.status == TeamMember.STATUS_REMOVED:
            membership.status = TeamMember.STATUS_PENDING
        membership.save(update_fields=["role", "invited_by", "status"])

        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_MEMBER_ASSIGNED,
            description=f"{user.username} assigned as {role}.",
            performed_by=actor,
            metadata={"userId": str(user.id), "role": role},
        )

        payload = _team_member_to_payload(membership)
        payload.message = "Member assigned."
        return payload

    @strawberry.mutation
    def remove_team_member(self, info: strawberry.Info, input: RemoveTeamMemberInput) -> TeamMemberMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return TeamMemberMutationPayload(success=False, message="Authentication required.", member=None)

        project = find_project_or_none(str(input.project_id))
        if project is None:
            return TeamMemberMutationPayload(success=False, message="Project not found.", member=None)

        membership = TeamMember.objects.filter(project=project, user_id=str(input.user_id)).first()
        if membership is None:
            return TeamMemberMutationPayload(success=False, message="Team member not found.", member=None)

        membership.status = TeamMember.STATUS_REMOVED
        membership.save(update_fields=["status"])
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_MEMBER_REMOVED,
            description=f"{membership.user.username} removed from project.",
            performed_by=actor,
            metadata={"userId": str(membership.user_id)},
        )

        payload = _team_member_to_payload(membership)
        payload.message = "Member removed."
        return payload

    @strawberry.mutation
    def upload_file(self, info: strawberry.Info, input: UploadFileInput) -> FileMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return FileMutationPayload(success=False, message="Authentication required.", file=None, project=None)

        project = find_project_or_none(str(input.project_id))
        if project is None:
            return FileMutationPayload(success=False, message="Project not found.", file=None, project=None)

        uploader = user_by_id(str(input.uploaded_by_id))
        if uploader is None:
            return FileMutationPayload(success=False, message="Uploader not found.", file=None, project=None)

        try:
            with transaction.atomic():
                file_row = attach_file_to_project(
                    project=project,
                    uploaded_by=uploader,
                    file_name=input.file_name,
                    file_path=input.file_path,
                    file_size=input.file_size,
                    file_type=input.file_type,
                )
                append_activity_log(
                    project=project,
                    action_type=ActivityLog.ACTION_FILE_UPLOADED,
                    description=f"File uploaded: {file_row.file_name}",
                    performed_by=actor,
                    metadata={"fileName": file_row.file_name, "size": file_row.file_size, "fileType": file_row.file_type},
                )
        except ValueError as exc:
            return FileMutationPayload(success=False, message=str(exc), file=None, project=None)

        from apps.projects.services import file_list_for_project

        uploaded = next((f for f in file_list_for_project(project) if str(f.id) == str(file_row.id)), None)
        return FileMutationPayload(success=True, message="File uploaded.", file=uploaded, project=to_project_type(project))

    @strawberry.mutation
    def delete_file(self, info: strawberry.Info, input: DeleteFileInput) -> FileMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return FileMutationPayload(success=False, message="Authentication required.", file=None, project=None)

        file_row = File.objects.select_related("project").filter(id=str(input.file_id)).first()
        if file_row is None:
            return FileMutationPayload(success=False, message="File not found.", file=None, project=None)

        project = file_row.project
        file_name = file_row.file_name
        file_size = file_row.file_size

        with transaction.atomic():
            from apps.projects.services import detach_file_from_project

            detach_file_from_project(file_row)
            append_activity_log(
                project=project,
                action_type=ActivityLog.ACTION_FILE_DELETED,
                description=f"File deleted: {file_name}",
                performed_by=actor,
                metadata={"fileName": file_name, "size": file_size},
            )

        return FileMutationPayload(success=True, message="File deleted.", file=None, project=to_project_type(project))

    @strawberry.mutation
    def create_support_ticket(self, info: strawberry.Info, input: CreateSupportTicketInput) -> SupportTicketMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return SupportTicketMutationPayload(success=False, message="Authentication required.", ticket=None)

        subject = input.subject.strip()
        description = input.description.strip()
        category = input.category.strip().lower()
        priority = input.priority.strip().lower()
        if not subject or not description:
            return SupportTicketMutationPayload(success=False, message="Subject and description are required.", ticket=None)
        if category not in {
            SupportTicket.CATEGORY_BUG_REPORT,
            SupportTicket.CATEGORY_STORAGE_ISSUE,
            SupportTicket.CATEGORY_AI_AGENT_ISSUE,
            SupportTicket.CATEGORY_BILLING,
            SupportTicket.CATEGORY_OTHER,
        }:
            return SupportTicketMutationPayload(success=False, message="Invalid category.", ticket=None)
        if priority not in {SupportTicket.PRIORITY_LOW, SupportTicket.PRIORITY_MEDIUM, SupportTicket.PRIORITY_HIGH}:
            return SupportTicketMutationPayload(success=False, message="Invalid priority.", ticket=None)

        linked_project = None
        if input.linked_project_id:
            linked_project = find_project_or_none(str(input.linked_project_id))

        ticket = create_support_ticket(
            raised_by=actor,
            subject=subject,
            category=category,
            priority=priority,
            description=description,
            linked_project=linked_project,
        )
        return SupportTicketMutationPayload(
            success=True,
            message="Support ticket created.",
            ticket=to_support_ticket_type(ticket, include_internal=False),
        )

    @strawberry.mutation
    def reply_support_ticket(self, info: strawberry.Info, input: ReplySupportTicketInput) -> SupportTicketMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return SupportTicketMutationPayload(success=False, message="Authentication required.", ticket=None)

        ticket = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(id=str(input.ticket_id))
            .first()
        )
        if ticket is None:
            return SupportTicketMutationPayload(success=False, message="Ticket not found.", ticket=None)
        if str(ticket.raised_by_id) != str(actor.id) and not is_user_admin(actor):
            return SupportTicketMutationPayload(success=False, message="Not authorized.", ticket=None)
        if input.is_internal_note and not is_user_admin(actor):
            return SupportTicketMutationPayload(success=False, message="Only admins can post internal notes.", ticket=None)

        message = input.message.strip()
        if not message:
            return SupportTicketMutationPayload(success=False, message="Reply message is required.", ticket=None)

        TicketReply.objects.create(ticket=ticket, author=actor, message=message, is_internal_note=input.is_internal_note)
        ticket.updated_at = timezone.now()
        ticket.save(update_fields=["updated_at"])

        refreshed = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .get(id=ticket.id)
        )
        return SupportTicketMutationPayload(
            success=True,
            message="Reply posted.",
            ticket=to_support_ticket_type(refreshed, include_internal=is_user_admin(actor)),
        )

    @strawberry.mutation
    def update_ticket_status(self, info: strawberry.Info, input: UpdateTicketStatusInput) -> SupportTicketMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None or not is_user_admin(actor):
            return SupportTicketMutationPayload(success=False, message="Admin access required.", ticket=None)

        ticket = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(id=str(input.ticket_id))
            .first()
        )
        if ticket is None:
            return SupportTicketMutationPayload(success=False, message="Ticket not found.", ticket=None)

        status = input.status.strip().lower()
        if status not in {
            SupportTicket.STATUS_OPEN,
            SupportTicket.STATUS_UNDER_REVIEW,
            SupportTicket.STATUS_IN_PROGRESS,
            SupportTicket.STATUS_RESOLVED,
            SupportTicket.STATUS_CLOSED,
        }:
            return SupportTicketMutationPayload(success=False, message="Invalid status.", ticket=None)

        ticket.status = status
        ticket.resolved_at = timezone.now() if status in {SupportTicket.STATUS_RESOLVED, SupportTicket.STATUS_CLOSED} else None
        ticket.save(update_fields=["status", "resolved_at", "updated_at"])

        return SupportTicketMutationPayload(
            success=True,
            message="Ticket status updated.",
            ticket=to_support_ticket_type(ticket, include_internal=True),
        )

    @strawberry.mutation
    def update_ticket_priority(self, info: strawberry.Info, input: UpdateTicketPriorityInput) -> SupportTicketMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None or not is_user_admin(actor):
            return SupportTicketMutationPayload(success=False, message="Admin access required.", ticket=None)

        ticket = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(id=str(input.ticket_id))
            .first()
        )
        if ticket is None:
            return SupportTicketMutationPayload(success=False, message="Ticket not found.", ticket=None)

        priority = input.priority.strip().lower()
        if priority not in {SupportTicket.PRIORITY_LOW, SupportTicket.PRIORITY_MEDIUM, SupportTicket.PRIORITY_HIGH}:
            return SupportTicketMutationPayload(success=False, message="Invalid priority.", ticket=None)

        ticket.priority = priority
        ticket.save(update_fields=["priority", "updated_at"])
        return SupportTicketMutationPayload(
            success=True,
            message="Ticket priority updated.",
            ticket=to_support_ticket_type(ticket, include_internal=True),
        )

    @strawberry.mutation
    def reopen_ticket(self, info: strawberry.Info, ticket_id: strawberry.ID) -> SupportTicketMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return SupportTicketMutationPayload(success=False, message="Authentication required.", ticket=None)

        ticket = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(id=str(ticket_id))
            .first()
        )
        if ticket is None:
            return SupportTicketMutationPayload(success=False, message="Ticket not found.", ticket=None)
        if str(ticket.raised_by_id) != str(actor.id) and not is_user_admin(actor):
            return SupportTicketMutationPayload(success=False, message="Not authorized.", ticket=None)

        ticket.status = SupportTicket.STATUS_OPEN
        ticket.resolved_at = None
        ticket.save(update_fields=["status", "resolved_at", "updated_at"])
        return SupportTicketMutationPayload(
            success=True,
            message="Ticket reopened.",
            ticket=to_support_ticket_type(ticket, include_internal=is_user_admin(actor)),
        )

    @strawberry.mutation
    def upload_ticket_attachment(self, info: strawberry.Info, input: UploadTicketAttachmentInput) -> SupportTicketMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return SupportTicketMutationPayload(success=False, message="Authentication required.", ticket=None)

        ticket = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(id=str(input.ticket_id))
            .first()
        )
        if ticket is None:
            return SupportTicketMutationPayload(success=False, message="Ticket not found.", ticket=None)
        if str(ticket.raised_by_id) != str(actor.id) and not is_user_admin(actor):
            return SupportTicketMutationPayload(success=False, message="Not authorized.", ticket=None)

        TicketAttachment.objects.create(
            ticket=ticket,
            uploaded_by=actor,
            file_name=input.file_name,
            file_path=input.file_path,
            file_size=input.file_size,
            file_type=input.file_type,
        )
        ticket.updated_at = timezone.now()
        ticket.save(update_fields=["updated_at"])
        refreshed = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .get(id=ticket.id)
        )
        return SupportTicketMutationPayload(
            success=True,
            message="Attachment uploaded.",
            ticket=to_support_ticket_type(refreshed, include_internal=is_user_admin(actor)),
        )

    @strawberry.mutation
    def configure_integration(self, info: strawberry.Info, input: ConfigureIntegrationInput) -> IntegrationMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return IntegrationMutationPayload(success=False, message="Authentication required.", integration=None)

        target_user = user_by_id(str(input.user_id))
        if target_user is None:
            return IntegrationMutationPayload(success=False, message="User not found.", integration=None)
        if str(actor.id) != str(target_user.id) and not is_user_admin(actor):
            return IntegrationMutationPayload(success=False, message="Not authorized.", integration=None)

        integration, message = configure_user_integration(target_user, input.slug.strip(), dict(input.config_data))
        return IntegrationMutationPayload(success=integration is not None, message=message, integration=integration)

    @strawberry.mutation
    def toggle_integration(self, info: strawberry.Info, input: ToggleIntegrationInput) -> IntegrationMutationPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return IntegrationMutationPayload(success=False, message="Authentication required.", integration=None)

        target_user = user_by_id(str(input.user_id))
        if target_user is None:
            return IntegrationMutationPayload(success=False, message="User not found.", integration=None)
        if str(actor.id) != str(target_user.id) and not is_user_admin(actor):
            return IntegrationMutationPayload(success=False, message="Not authorized.", integration=None)

        integration, message = toggle_user_integration(target_user, input.slug.strip(), input.is_enabled)
        return IntegrationMutationPayload(success=integration is not None, message=message, integration=integration)

    @strawberry.mutation
    def remove_integration(self, info: strawberry.Info, input: RemoveIntegrationInput) -> IntegrationRemovalPayload:
        actor = get_authenticated_user(info)
        if actor is None:
            return IntegrationRemovalPayload(success=False, message="Authentication required.")

        target_user = user_by_id(str(input.user_id))
        if target_user is None:
            return IntegrationRemovalPayload(success=False, message="User not found.")
        if str(actor.id) != str(target_user.id) and not is_user_admin(actor):
            return IntegrationRemovalPayload(success=False, message="Not authorized.")

        success, message = remove_user_integration(target_user, input.slug.strip())
        return IntegrationRemovalPayload(success=success, message=message)

    # Legacy mutations retained for existing UI behavior.
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
        append_activity_log(
            project=project,
            action_type=ActivityLog.ACTION_COMMENT_ADDED,
            description="Comment added to review queue.",
            performed_by=user,
            metadata={"comment": comment_text},
        )

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
                "id": f"deploy-{timezone.now().strftime('%Y%m%d%H%M%S')}",
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
                "id": f"rollback-{timezone.now().strftime('%Y%m%d%H%M%S')}",
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
