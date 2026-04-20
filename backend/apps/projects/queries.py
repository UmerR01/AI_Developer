from __future__ import annotations

import strawberry
from strawberry.types import Info

from apps.projects.models import Project
from apps.projects.services import ensure_seed_projects, get_authenticated_user, to_project_type
from apps.projects.types import ProjectType


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

        queryset = Project.objects.select_related("owner").all()
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

        try:
            project = Project.objects.select_related("owner").get(slug=str(project_id))
        except Project.DoesNotExist:
            return None

        return to_project_type(project)
