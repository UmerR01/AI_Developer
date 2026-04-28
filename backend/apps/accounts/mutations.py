from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
import strawberry

from apps.accounts.models import AccountProfile
from apps.accounts.services import authenticate_user, create_access_token
from apps.accounts.types import AuthPayload, LoginInput, SignupInput, UserType
from apps.projects.services import get_or_create_storage_for_user, get_or_create_user_subscription


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

    @strawberry.mutation
    def signup(self, input: SignupInput) -> AuthPayload:
        username = input.username.strip()
        email = (input.email or "").strip() or None
        password = input.password

        if not username:
            return AuthPayload(success=False, message="Username is required.", access_token=None, user=None)

        if not password:
            return AuthPayload(success=False, message="Password is required.", access_token=None, user=None)

        user_model = get_user_model()
        if user_model.objects.filter(username__iexact=username).exists():
            return AuthPayload(success=False, message="Username is already taken.", access_token=None, user=None)

        if email and user_model.objects.filter(email__iexact=email).exists():
            return AuthPayload(success=False, message="Email is already in use.", access_token=None, user=None)

        with transaction.atomic():
            user = user_model.objects.create_user(username=username, email=email or "", password=password)
            AccountProfile.objects.update_or_create(user=user, defaults={"is_admin": True})
            get_or_create_storage_for_user(user)
            get_or_create_user_subscription(user)

        token = create_access_token(user)
        return AuthPayload(
            success=True,
            message="Signup successful.",
            access_token=token,
            user=UserType(id=str(user.id), username=user.username, email=user.email),
        )
