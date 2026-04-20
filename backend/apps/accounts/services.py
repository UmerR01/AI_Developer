from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model


def authenticate_user(username: str, password: str):
    return authenticate(username=username, password=password)


def create_access_token(user) -> str:
    expires_at = datetime.now(tz=UTC) + timedelta(hours=8)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def get_user_from_token(token: str):
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    user_model = get_user_model()
    try:
        return user_model.objects.get(id=user_id)
    except user_model.DoesNotExist:
        return None
