from django.core.management.base import BaseCommand

from apps.projects.services import ensure_default_subscription_plans


class Command(BaseCommand):
    help = "Seed default subscription plans for the platform."

    def handle(self, *args, **options):
        ensure_default_subscription_plans()
        self.stdout.write(self.style.SUCCESS("Subscription plans seeded."))
