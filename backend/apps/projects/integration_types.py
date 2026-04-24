from __future__ import annotations

import strawberry
from strawberry.scalars import JSON


@strawberry.type
class IntegrationDefinitionType:
    id: strawberry.ID
    slug: str
    name: str
    description: str
    category: str
    logo_key: str
    is_active: bool
    docs_url: str | None
    config_fields: JSON


@strawberry.type
class UserIntegrationType:
    id: strawberry.ID
    user_id: strawberry.ID
    integration_id: strawberry.ID
    is_enabled: bool
    is_configured: bool
    config_data: JSON | None
    configured_at: str | None
    last_toggled_at: str | None


@strawberry.type
class IntegrationSummaryType:
    id: strawberry.ID
    slug: str
    name: str
    description: str
    category: str
    logo_key: str
    is_active: bool
    docs_url: str | None
    config_fields: JSON
    is_enabled: bool
    is_configured: bool
    configured_at: str | None
    last_toggled_at: str | None


@strawberry.type
class IntegrationDetailType:
    id: strawberry.ID
    slug: str
    name: str
    description: str
    category: str
    logo_key: str
    is_active: bool
    docs_url: str | None
    config_fields: JSON
    config_data: JSON | None
    is_enabled: bool
    is_configured: bool
    configured_at: str | None
    last_toggled_at: str | None


@strawberry.input
class ConfigureIntegrationInput:
    user_id: strawberry.ID
    slug: str
    config_data: JSON


@strawberry.input
class ToggleIntegrationInput:
    user_id: strawberry.ID
    slug: str
    is_enabled: bool


@strawberry.input
class RemoveIntegrationInput:
    user_id: strawberry.ID
    slug: str


@strawberry.type
class IntegrationMutationPayload:
    success: bool
    message: str
    integration: IntegrationDetailType | None


@strawberry.type
class IntegrationRemovalPayload:
    success: bool
    message: str
