from __future__ import annotations

import strawberry
from strawberry.types import Info

from apps.accounts.services import get_user_from_token
from apps.accounts.types import UserType


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


@strawberry.type
class AuthQuery:
    @strawberry.field
    def auth_health(self) -> str:
        return "ok"

    @strawberry.field
    def me(self, info: Info) -> UserType | None:
        token = _extract_bearer_token(info)
        if not token:
            return None

        user = get_user_from_token(token)
        if user is None:
            return None

        return UserType(id=str(user.id), username=user.username, email=user.email)
