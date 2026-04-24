from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.projects.models import IntegrationDefinition


class Command(BaseCommand):
    help = "Seed default integration definitions."

    def handle(self, *args, **options):
        definitions = [
            {
                "slug": "openai",
                "name": "OpenAI",
                "category": IntegrationDefinition.CATEGORY_AI_MODEL,
                "description": "Connect GPT models to power your AI agents.",
                "docs_url": "https://platform.openai.com/docs",
                "logo_key": "openai",
                "config_fields": [
                    {"key": "api_key", "label": "API Key", "type": "password", "required": True},
                    {
                        "key": "model",
                        "label": "Default Model",
                        "type": "select",
                        "options": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
                        "required": True,
                    },
                ],
            },
            {
                "slug": "claude",
                "name": "Claude",
                "category": IntegrationDefinition.CATEGORY_AI_MODEL,
                "description": "Anthropic Claude models for reasoning and analysis.",
                "docs_url": "https://docs.anthropic.com",
                "logo_key": "claude",
                "config_fields": [
                    {"key": "api_key", "label": "API Key", "type": "password", "required": True},
                    {
                        "key": "model",
                        "label": "Default Model",
                        "type": "select",
                        "options": ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku"],
                        "required": True,
                    },
                ],
            },
            {
                "slug": "gemini",
                "name": "Gemini",
                "category": IntegrationDefinition.CATEGORY_AI_MODEL,
                "description": "Google Gemini models for multimodal AI tasks.",
                "docs_url": "https://ai.google.dev/docs",
                "logo_key": "gemini",
                "config_fields": [
                    {"key": "api_key", "label": "API Key", "type": "password", "required": True},
                    {
                        "key": "model",
                        "label": "Default Model",
                        "type": "select",
                        "options": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
                        "required": True,
                    },
                ],
            },
            {
                "slug": "figma",
                "name": "Figma",
                "category": IntegrationDefinition.CATEGORY_DESIGN,
                "description": "Sync design files and assets directly to projects.",
                "docs_url": "https://www.figma.com/developers/api",
                "logo_key": "figma",
                "config_fields": [
                    {"key": "access_token", "label": "Access Token", "type": "password", "required": True},
                    {"key": "team_id", "label": "Team ID", "type": "text", "required": False},
                ],
            },
            {
                "slug": "github",
                "name": "GitHub",
                "category": IntegrationDefinition.CATEGORY_DEVOPS,
                "description": "Link repositories and track code changes per project.",
                "docs_url": "https://docs.github.com/en/rest",
                "logo_key": "github",
                "config_fields": [
                    {"key": "access_token", "label": "Personal Access Token", "type": "password", "required": True},
                    {"key": "default_repo", "label": "Default Repository", "type": "text", "required": False},
                    {
                        "key": "default_branch",
                        "label": "Default Branch",
                        "type": "text",
                        "required": False,
                        "default": "main",
                    },
                ],
            },
            {
                "slug": "aws",
                "name": "AWS",
                "category": IntegrationDefinition.CATEGORY_CLOUD,
                "description": "Connect S3 buckets and Lambda for cloud deployments.",
                "docs_url": "https://docs.aws.amazon.com",
                "logo_key": "aws",
                "config_fields": [
                    {"key": "access_key_id", "label": "Access Key ID", "type": "password", "required": True},
                    {"key": "secret_access_key", "label": "Secret Access Key", "type": "password", "required": True},
                    {
                        "key": "region",
                        "label": "Region",
                        "type": "select",
                        "options": ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1"],
                        "required": True,
                    },
                    {"key": "s3_bucket", "label": "S3 Bucket", "type": "text", "required": False},
                ],
            },
        ]

        for definition in definitions:
            IntegrationDefinition.objects.update_or_create(
                slug=definition["slug"],
                defaults={
                    "name": definition["name"],
                    "description": definition["description"],
                    "category": definition["category"],
                    "logo_key": definition["logo_key"],
                    "is_active": True,
                    "docs_url": definition["docs_url"],
                    "config_fields": definition["config_fields"],
                },
            )

        self.stdout.write(self.style.SUCCESS("Integration definitions seeded."))
