from __future__ import annotations

import strawberry
from strawberry.types import Info

from apps.projects.services import (
    admin_profile_for_user,
    ensure_seed_projects,
    file_list_for_project,
    find_project_or_none,
    get_authenticated_user,
    is_user_admin,
    list_projects_for_owner,
    integration_detail_for_user,
    integration_summary_for_user,
    storage_stats_for_user,
    subscription_info_for_user,
    team_members_for_project,
    team_overview_for_admin,
    timeline_for_project,
    to_support_ticket_type,
    to_project_type,
    user_by_id,
)
from apps.projects.models import SupportTicket
from apps.projects.types import (
    ActivityLogType,
    AdminProfileType,
    FileType,
    ProjectType,
    StorageStatsType,
    SubscriptionInfoType,
    SupportTicketType,
    TeamMemberType,
    TeamOverviewType,
)
from apps.projects.integration_types import IntegrationDetailType, IntegrationSummaryType


@strawberry.type
class ProjectQuery:
    @strawberry.field
    def projects(
        self,
        info: Info,
        search: str | None = None,
        sort_by: str | None = None,
    ) -> list[ProjectType]:
        user = get_authenticated_user(info)
        if user is None:
            return []

        ensure_seed_projects()

        queryset = list_projects_for_owner(None)
        if search:
            queryset = queryset.filter(name__icontains=search)

        if sort_by == "name":
            queryset = queryset.order_by("name")
        elif sort_by == "state":
            queryset = queryset.order_by("state", "-updated_at")
        else:
            queryset = queryset.order_by("-updated_at")

        return [to_project_type(project) for project in queryset]

    @strawberry.field
    def project(self, info: Info, project_id: strawberry.ID) -> ProjectType | None:
        user = get_authenticated_user(info)
        if user is None:
            return None

        ensure_seed_projects()

        project = find_project_or_none(str(project_id))
        if project is None:
            return None

        return to_project_type(project)

    @strawberry.field
    def get_project(self, info: Info, id: strawberry.ID) -> ProjectType | None:
        user = get_authenticated_user(info)
        if user is None:
            return None

        ensure_seed_projects()
        project = find_project_or_none(str(id))
        if project is None:
            return None

        return to_project_type(project)

    @strawberry.field
    def list_projects(self, info: Info, owner_id: strawberry.ID | None = None) -> list[ProjectType]:
        user = get_authenticated_user(info)
        if user is None:
            return []

        ensure_seed_projects()
        queryset = list_projects_for_owner(str(owner_id) if owner_id else None)
        return [to_project_type(project) for project in queryset]

    @strawberry.field
    def get_team_members(self, info: Info, project_id: strawberry.ID) -> list[TeamMemberType]:
        user = get_authenticated_user(info)
        if user is None:
            return []

        ensure_seed_projects()
        project = find_project_or_none(str(project_id))
        if project is None:
            return []

        return team_members_for_project(project)

    @strawberry.field
    def get_project_files(self, info: Info, project_id: strawberry.ID) -> list[FileType]:
        user = get_authenticated_user(info)
        if user is None:
            return []

        ensure_seed_projects()
        project = find_project_or_none(str(project_id))
        if project is None:
            return []

        return file_list_for_project(project)

    @strawberry.field
    def get_project_timeline(
        self,
        info: Info,
        project_id: strawberry.ID,
        action_type: str | None = None,
    ) -> list[ActivityLogType]:
        user = get_authenticated_user(info)
        if user is None:
            return []

        ensure_seed_projects()
        project = find_project_or_none(str(project_id))
        if project is None:
            return []

        return timeline_for_project(project, action_type)

    @strawberry.field
    def get_storage_stats(self, info: Info, user_id: strawberry.ID) -> StorageStatsType | None:
        actor = get_authenticated_user(info)
        if actor is None:
            return None

        target = user_by_id(str(user_id))
        if target is None:
            return None
        if str(actor.id) != str(target.id) and not is_user_admin(actor):
            return None
        return storage_stats_for_user(target)

    @strawberry.field
    def get_subscription_info(self, info: Info, user_id: strawberry.ID) -> SubscriptionInfoType | None:
        actor = get_authenticated_user(info)
        if actor is None:
            return None

        target = user_by_id(str(user_id))
        if target is None:
            return None
        if str(actor.id) != str(target.id) and not is_user_admin(actor):
            return None
        return subscription_info_for_user(target)

    @strawberry.field
    def get_team_overview(self, info: Info, admin_user_id: strawberry.ID) -> TeamOverviewType | None:
        actor = get_authenticated_user(info)
        if actor is None or not is_user_admin(actor):
            return None

        target = user_by_id(str(admin_user_id))
        if target is None or not is_user_admin(target):
            return None
        return team_overview_for_admin(target)

    @strawberry.field
    def get_admin_profile(self, info: Info, user_id: strawberry.ID) -> AdminProfileType | None:
        actor = get_authenticated_user(info)
        if actor is None:
            return None

        target = user_by_id(str(user_id))
        if target is None:
            return None
        if str(actor.id) != str(target.id) and not is_user_admin(actor):
            return None
        return admin_profile_for_user(target)

    @strawberry.field
    def my_support_tickets(self, info: Info) -> list[SupportTicketType]:
        actor = get_authenticated_user(info)
        if actor is None:
            return []

        queryset = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(raised_by=actor)
            .order_by("-updated_at")
        )
        return [to_support_ticket_type(ticket, include_internal=False) for ticket in queryset]

    @strawberry.field
    def support_ticket(self, info: Info, ticket_id: strawberry.ID) -> SupportTicketType | None:
        actor = get_authenticated_user(info)
        if actor is None:
            return None

        ticket = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .filter(id=str(ticket_id))
            .first()
        )
        if ticket is None:
            return None

        if str(ticket.raised_by_id) != str(actor.id) and not is_user_admin(actor):
            return None

        return to_support_ticket_type(ticket, include_internal=is_user_admin(actor))

    @strawberry.field
    def list_all_support_tickets(self, info: Info) -> list[SupportTicketType]:
        actor = get_authenticated_user(info)
        if actor is None or not is_user_admin(actor):
            return []

        queryset = (
            SupportTicket.objects.select_related("raised_by", "linked_project")
            .prefetch_related("replies__author", "attachments__uploaded_by")
            .order_by("-updated_at")
        )
        return [to_support_ticket_type(ticket, include_internal=True) for ticket in queryset]

    @strawberry.field
    def list_integrations(self, info: Info, user_id: strawberry.ID) -> list[IntegrationSummaryType]:
        actor = get_authenticated_user(info)
        if actor is None:
            return []

        target = user_by_id(str(user_id))
        if target is None:
            return []
        if str(actor.id) != str(target.id) and not is_user_admin(actor):
            return []

        return integration_summary_for_user(target)

    @strawberry.field
    def get_integration_detail(self, info: Info, user_id: strawberry.ID, slug: str) -> IntegrationDetailType | None:
        actor = get_authenticated_user(info)
        if actor is None:
            return None

        target = user_by_id(str(user_id))
        if target is None:
            return None
        if str(actor.id) != str(target.id) and not is_user_admin(actor):
            return None

        return integration_detail_for_user(target, slug)
