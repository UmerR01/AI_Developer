from __future__ import annotations

from django.core.management.base import BaseCommand
from apps.projects.services import ensure_default_integrations


class Command(BaseCommand):
    help = "Seed default integration definitions."

    def handle(self, *args, **options):
        ensure_default_integrations()

        self.stdout.write(self.style.SUCCESS("Integration definitions seeded."))
