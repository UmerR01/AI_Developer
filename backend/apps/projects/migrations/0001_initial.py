# Generated manually for demo phase.

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("name", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True)),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("Draft", "Draft"),
                            ("In Progress", "In Progress"),
                            ("In Review", "In Review"),
                            ("Pending Push", "Pending Push"),
                            ("Revising", "Revising"),
                            ("Live", "Live"),
                        ],
                        default="Draft",
                        max_length=20,
                    ),
                ),
                ("open_comments", models.PositiveIntegerField(default=0)),
                ("approved_comments", models.PositiveIntegerField(default=0)),
                ("pushed_comments", models.PositiveIntegerField(default=0)),
                ("tasks_json", models.JSONField(blank=True, default=list)),
                ("activity_json", models.JSONField(blank=True, default=list)),
                ("artifacts_json", models.JSONField(blank=True, default=list)),
                ("deployments_json", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="owned_projects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-updated_at"]},
        ),
    ]
