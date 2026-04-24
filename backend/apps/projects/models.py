from django.conf import settings
from django.db import models


class Storage(models.Model):
    # TODO: Link to Subscription model when billing is implemented.
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="storage")
    total_quota = models.BigIntegerField()
    used_space = models.BigIntegerField(default=0)
    folder_name = models.CharField(max_length=255)
    subscription = models.ForeignKey(
        "UserSubscription",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="storage_rows",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Storage<{self.owner_id}>"


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

    storage = models.ForeignKey("Storage", on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    folder_path = models.CharField(max_length=255, blank=True)
    used_storage = models.BigIntegerField(default=0)
    is_deleted = models.BooleanField(default=False)

    open_comments = models.PositiveIntegerField(default=0)
    approved_comments = models.PositiveIntegerField(default=0)
    pushed_comments = models.PositiveIntegerField(default=0)

    # TODO: migrate tasks_json into relational task models.
    tasks_json = models.JSONField(default=list, blank=True)
    # TODO: migrate activity_json into ActivityLog model only.
    activity_json = models.JSONField(default=list, blank=True)
    # TODO: migrate artifacts_json into File model only.
    artifacts_json = models.JSONField(default=list, blank=True)
    # TODO: migrate deployments_json into relational deployment models.
    deployments_json = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.state})"


class TeamMember(models.Model):
    ROLE_DEVELOPER = "developer"
    ROLE_QA = "qa"
    ROLE_CHOICES = [
        (ROLE_DEVELOPER, "Developer"),
        (ROLE_QA, "QA"),
    ]

    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_REMOVED = "removed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_REMOVED, "Removed"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_memberships")
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="team_members")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="invitations_sent")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    date_invited = models.DateTimeField(auto_now_add=True)
    date_joined = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "project")
        ordering = ["-date_invited"]

    def __str__(self) -> str:
        return f"TeamMember<{self.project_id}:{self.user_id}:{self.role}>"


class File(models.Model):
    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="files")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="uploaded_files")
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField()
    file_type = models.CharField(max_length=40)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return f"File<{self.project_id}:{self.file_name}>"


class ActivityLog(models.Model):
    ACTION_FILE_UPLOADED = "file_uploaded"
    ACTION_FILE_DELETED = "file_deleted"
    ACTION_MEMBER_ASSIGNED = "member_assigned"
    ACTION_MEMBER_REMOVED = "member_removed"
    ACTION_TASK_CREATED = "task_created"
    ACTION_TASK_UPDATED = "task_updated"
    ACTION_COMMENT_ADDED = "comment_added"
    ACTION_AI_OUTPUT_GENERATED = "ai_output_generated"
    ACTION_STATUS_CHANGED = "status_changed"
    ACTION_PROJECT_CREATED = "project_created"
    ACTION_PROJECT_UPDATED = "project_updated"
    ACTION_INTEGRATION_CONFIGURED = "integration_configured"
    ACTION_INTEGRATION_TOGGLED = "integration_toggled"
    ACTION_INTEGRATION_REMOVED = "integration_removed"

    ACTION_CHOICES = [
        (ACTION_FILE_UPLOADED, "File Uploaded"),
        (ACTION_FILE_DELETED, "File Deleted"),
        (ACTION_MEMBER_ASSIGNED, "Member Assigned"),
        (ACTION_MEMBER_REMOVED, "Member Removed"),
        (ACTION_TASK_CREATED, "Task Created"),
        (ACTION_TASK_UPDATED, "Task Updated"),
        (ACTION_COMMENT_ADDED, "Comment Added"),
        (ACTION_AI_OUTPUT_GENERATED, "AI Output Generated"),
        (ACTION_STATUS_CHANGED, "Status Changed"),
        (ACTION_PROJECT_CREATED, "Project Created"),
        (ACTION_PROJECT_UPDATED, "Project Updated"),
        (ACTION_INTEGRATION_CONFIGURED, "Integration Configured"),
        (ACTION_INTEGRATION_TOGGLED, "Integration Toggled"),
        (ACTION_INTEGRATION_REMOVED, "Integration Removed"),
    ]

    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="activity_logs")
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_activity_events",
    )
    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES)
    description = models.TextField()
    metadata = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self) -> str:
        return f"ActivityLog<{self.project_id}:{self.action_type}>"


class SubscriptionPlan(models.Model):
    NAME_FREE = "free"
    NAME_BASIC = "basic"
    NAME_PRO = "pro"
    NAME_ENTERPRISE = "enterprise"
    NAME_CHOICES = [
        (NAME_FREE, "Free"),
        (NAME_BASIC, "Basic"),
        (NAME_PRO, "Pro"),
        (NAME_ENTERPRISE, "Enterprise"),
    ]

    name = models.CharField(max_length=20, choices=NAME_CHOICES, unique=True)
    display_name = models.CharField(max_length=60)
    storage_limit = models.BigIntegerField()
    max_projects = models.IntegerField(default=2)
    max_team_members = models.IntegerField(default=2)
    price_display = models.CharField(max_length=40)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"SubscriptionPlan<{self.name}>"


class UserSubscription(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    ]

    # TODO: Connect to real payment gateway when billing is implemented.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_subscription")
    plan = models.ForeignKey("SubscriptionPlan", on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    started_at = models.DateTimeField(auto_now_add=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"UserSubscription<{self.user_id}:{self.plan_id}>"


class TeamInvite(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    ]

    ROLE_DEVELOPER = TeamMember.ROLE_DEVELOPER
    ROLE_QA = TeamMember.ROLE_QA
    ROLE_CHOICES = TeamMember.ROLE_CHOICES

    project = models.ForeignKey("Project", on_delete=models.CASCADE, related_name="team_invites")
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="team_invites_sent")
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    date_invited = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-date_invited"]

    def __str__(self) -> str:
        return f"TeamInvite<{self.project_id}:{self.email}:{self.status}>"


class SupportTicket(models.Model):
    CATEGORY_BUG_REPORT = "bug_report"
    CATEGORY_STORAGE_ISSUE = "storage_issue"
    CATEGORY_AI_AGENT_ISSUE = "ai_agent_issue"
    CATEGORY_BILLING = "billing"
    CATEGORY_OTHER = "other"
    CATEGORY_CHOICES = [
        (CATEGORY_BUG_REPORT, "Bug Report"),
        (CATEGORY_STORAGE_ISSUE, "Storage Issue"),
        (CATEGORY_AI_AGENT_ISSUE, "AI Agent Issue"),
        (CATEGORY_BILLING, "Billing"),
        (CATEGORY_OTHER, "Other"),
    ]

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
    ]

    STATUS_OPEN = "open"
    STATUS_UNDER_REVIEW = "under_review"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_UNDER_REVIEW, "Under Review"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_CLOSED, "Closed"),
    ]

    ticket_number = models.CharField(max_length=20, unique=True)
    raised_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_tickets")
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    description = models.TextField()
    linked_project = models.ForeignKey("Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="support_tickets")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"SupportTicket<{self.ticket_number}:{self.status}>"


class TicketReply(models.Model):
    ticket = models.ForeignKey("SupportTicket", on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="ticket_replies")
    message = models.TextField()
    is_internal_note = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"TicketReply<{self.ticket_id}:{self.id}>"


class TicketAttachment(models.Model):
    ticket = models.ForeignKey("SupportTicket", on_delete=models.CASCADE, related_name="attachments")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="ticket_attachments")
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField(default=0)
    file_type = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"TicketAttachment<{self.ticket_id}:{self.file_name}>"


class IntegrationDefinition(models.Model):
    CATEGORY_AI_MODEL = "ai_model"
    CATEGORY_DESIGN = "design"
    CATEGORY_DEVOPS = "devops"
    CATEGORY_CLOUD = "cloud"
    CATEGORY_CHOICES = [
        (CATEGORY_AI_MODEL, "AI Models"),
        (CATEGORY_DESIGN, "Design"),
        (CATEGORY_DEVOPS, "DevOps"),
        (CATEGORY_CLOUD, "Cloud"),
    ]

    slug = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    logo_key = models.CharField(max_length=40)
    is_active = models.BooleanField(default=True)
    docs_url = models.CharField(max_length=255, null=True, blank=True)
    config_fields = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"IntegrationDefinition<{self.slug}>"


class UserIntegration(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="integrations")
    integration = models.ForeignKey("IntegrationDefinition", on_delete=models.CASCADE, related_name="user_integrations")
    is_enabled = models.BooleanField(default=False)
    is_configured = models.BooleanField(default=False)
    # TODO: Encrypt config_data at rest before production. Use django-fernet-fields or similar.
    config_data = models.JSONField(null=True, blank=True)
    configured_at = models.DateTimeField(null=True, blank=True)
    last_toggled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "integration")
        ordering = ["integration__name"]

    def __str__(self) -> str:
        return f"UserIntegration<{self.user_id}:{self.integration_id}>"
