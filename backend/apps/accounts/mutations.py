from __future__ import annotations

import strawberry

from apps.accounts.services import authenticate_user, create_access_token
from apps.accounts.types import AuthPayload, LoginInput, UserType


@strawberry.type
class AuthMutation:
    @strawberry.mutation
    def login(self, input: LoginInput) -> AuthPayload:
        user = authenticate_user(username=input.username, password=input.password)
        if user is None:
            return AuthPayload(
                success=False,
                message="Invalid username or password.",
                access_token=None,
                user=None,
            )

        token = create_access_token(user)
        return AuthPayload(
            success=True,
            message="Login successful.",
            access_token=token,
            user=UserType(id=str(user.id), username=user.username, email=user.email),
        )
