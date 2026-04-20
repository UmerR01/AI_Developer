from __future__ import annotations

import strawberry


@strawberry.type
class UserType:
    id: strawberry.ID
    username: str
    email: str | None


@strawberry.input
class LoginInput:
    username: str
    password: str


@strawberry.type
class AuthPayload:
    success: bool
    message: str
    access_token: str | None
    user: UserType | None
