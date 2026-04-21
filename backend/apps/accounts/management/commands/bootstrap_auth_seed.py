from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


SEED_ACCOUNTS = [
    {
        "username": "ibrahim",
        "email": "ibrahim@ai-developer.local",
        "display_name": "Ibrahim",
        "password": "Ibrahim@123",
        "role": "ADMIN",
        "is_staff": True,
        "is_superuser": True,
    },
    {
        "username": "ismail",
        "email": "ismail@ai-developer.local",
        "display_name": "Ismail",
        "password": "Ismail@123",
        "role": "DEVELOPER",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "zahid",
        "email": "zahid@ai-developer.local",
        "display_name": "Zahid",
        "password": "Zahid@123",
        "role": "QA",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "faizan",
        "email": "faizan@ai-developer.local",
        "display_name": "Faizan",
        "password": "Faizan@123",
        "role": "QA",
        "is_staff": False,
        "is_superuser": False,
    },
    {
        "username": "ai_dev",
        "email": "ai_dev@ai-developer.local",
        "display_name": "AI_dev",
        "password": "AI_dev@123",
        "role": "SUPPORT",
        "is_staff": False,
        "is_superuser": False,
    },
]

ROLE_GROUPS = ["ADMIN", "DEVELOPER", "QA", "SUPPORT"]
TEAM_GROUP = "TEAM_IBRAHIM"
TEAM_MEMBER_USERNAMES = {"ibrahim", "ismail", "zahid", "faizan"}


class Command(BaseCommand):
    help = "Create or update demo accounts, role groups, and Ibrahim team members."

    def handle(self, *args, **options):
        user_model = get_user_model()

        role_groups = {
            role_name: Group.objects.get_or_create(name=role_name)[0] for role_name in ROLE_GROUPS
        }
        team_group = Group.objects.get_or_create(name=TEAM_GROUP)[0]

        for account in SEED_ACCOUNTS:
            display_name = account["display_name"]
            first_name, *remaining = display_name.split(" ")
            last_name = " ".join(remaining)

            user, created = user_model.objects.get_or_create(
                username=account["username"],
                defaults={
                    "email": account["email"],
                    "first_name": first_name,
                    "last_name": last_name,
                    "is_staff": account["is_staff"],
                    "is_superuser": account["is_superuser"],
                },
            )

            user.email = account["email"]
            user.first_name = first_name
            user.last_name = last_name
            user.is_staff = account["is_staff"]
            user.is_superuser = account["is_superuser"]
            user.set_password(account["password"])
            user.save(
                update_fields=[
                    "email",
                    "first_name",
                    "last_name",
                    "is_staff",
                    "is_superuser",
                    "password",
                ]
            )

            # Keep role assignment deterministic so repeated command runs are safe.
            user.groups.remove(*role_groups.values())
            user.groups.add(role_groups[account["role"]])

            if account["username"] in TEAM_MEMBER_USERNAMES:
                user.groups.add(team_group)
            else:
                user.groups.remove(team_group)

            status_text = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{status_text} account: {account['username']} ({account['role']})"))

        self.stdout.write(self.style.SUCCESS("Demo team: Ibrahim with Ismail, Zahid, and Faizan."))
        self.stdout.write(
            self.style.SUCCESS(
                "Quick subscriptions (mock): Basic 300GB, Pro 500GB, Enterprise 1TB. Linked account: Ibrahim -> Pro."
            )
        )
