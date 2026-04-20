import strawberry

from apps.accounts.mutations import AuthMutation
from apps.accounts.queries import AuthQuery
from apps.projects.mutations import ProjectMutation
from apps.projects.queries import ProjectQuery


@strawberry.type
class Query(AuthQuery, ProjectQuery):
    pass


@strawberry.type
class Mutation(AuthMutation, ProjectMutation):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
