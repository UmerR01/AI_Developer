from django.conf import settings
from django.db import models


class Project(models.Model):
    STATE_DRAFT = "Draft"
    STATE_IN_PROGRESS = "In Progress"
    STATE_IN_REVIEW = "In Review"
    STATE_PENDING_PUSH = "Pending Push"
    STATE_REVISING = "Revising"
    STATE_LIVE = "Live"

    STATE_CHOICES = [
        (STATE_DRAFT, STATE_DRAFT),
        (STATE_IN_PROGRESS, STATE_IN_PROGRESS),
        (STATE_IN_REVIEW, STATE_IN_REVIEW),
        (STATE_PENDING_PUSH, STATE_PENDING_PUSH),
        (STATE_REVISING, STATE_REVISING),
        (STATE_LIVE, STATE_LIVE),
    ]

    slug = models.SlugField(max_length=120, unique=True)
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default=STATE_DRAFT)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_projects",
    )

    open_comments = models.PositiveIntegerField(default=0)
    approved_comments = models.PositiveIntegerField(default=0)
    pushed_comments = models.PositiveIntegerField(default=0)

    tasks_json = models.JSONField(default=list, blank=True)
    activity_json = models.JSONField(default=list, blank=True)
    artifacts_json = models.JSONField(default=list, blank=True)
    deployments_json = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.state})"
