from django.conf import settings
from django.db import migrations


def seed_subscription_data(apps, schema_editor):
    user_model = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    AccountProfile = apps.get_model("accounts", "AccountProfile")
    SubscriptionPlan = apps.get_model("projects", "SubscriptionPlan")
    UserSubscription = apps.get_model("projects", "UserSubscription")
    Storage = apps.get_model("projects", "Storage")

    free_plan, _ = SubscriptionPlan.objects.get_or_create(
        name="free",
        defaults={
            "display_name": "Free",
            "storage_limit": 5 * 1024 * 1024 * 1024,
            "max_projects": 2,
            "max_team_members": 2,
            "price_display": "$0/mo",
            "is_active": True,
        },
    )
    SubscriptionPlan.objects.get_or_create(
        name="basic",
        defaults={
            "display_name": "Basic",
            "storage_limit": 50 * 1024 * 1024 * 1024,
            "max_projects": 10,
            "max_team_members": 10,
            "price_display": "$19/mo",
            "is_active": True,
        },
    )
    SubscriptionPlan.objects.get_or_create(
        name="pro",
        defaults={
            "display_name": "Pro",
            "storage_limit": 250 * 1024 * 1024 * 1024,
            "max_projects": 50,
            "max_team_members": 40,
            "price_display": "$79/mo",
            "is_active": True,
        },
    )
    SubscriptionPlan.objects.get_or_create(
        name="enterprise",
        defaults={
            "display_name": "Enterprise",
            "storage_limit": 1024 * 1024 * 1024 * 1024,
            "max_projects": 500,
            "max_team_members": 250,
            "price_display": "Contact sales",
            "is_active": True,
        },
    )

    admin_user_ids = set(
        AccountProfile.objects.filter(is_admin=True).values_list("user_id", flat=True)
    )
    for user in user_model.objects.filter(id__in=admin_user_ids):
        subscription, _ = UserSubscription.objects.get_or_create(
            user_id=user.id,
            defaults={"plan_id": free_plan.id, "status": "active"},
        )
        if subscription.plan_id != free_plan.id:
            subscription.plan_id = free_plan.id
            subscription.status = "active"
            subscription.save(update_fields=["plan", "status"])

        storage = Storage.objects.filter(owner_id=user.id).first()
        if storage is None:
            storage = Storage.objects.create(
                owner_id=user.id,
                total_quota=free_plan.storage_limit,
                used_space=0,
                folder_name=f"storage/{user.username}",
                subscription_id=subscription.id,
            )
        else:
            changed = []
            if storage.subscription_id != subscription.id:
                storage.subscription_id = subscription.id
                changed.append("subscription")
            if storage.total_quota != free_plan.storage_limit:
                storage.total_quota = free_plan.storage_limit
                changed.append("total_quota")
            if changed:
                storage.save(update_fields=changed)


def unseed_subscription_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("projects", "0003_subscriptionplan_supportticket_teaminvite_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_subscription_data, unseed_subscription_data),
    ]
