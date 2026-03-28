from django.db import models

# Create your models here.
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone


class AdminSupportSession(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_DECLINED = "declined"
    STATUS_TERMINATED = "terminated"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_TERMINATED, "Terminated"),
        (STATUS_EXPIRED, "Expired"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owner_support_sessions",
    )
    admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_support_sessions",
    )

    reason = models.CharField(max_length=255, blank=True, default="Help me post a property")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    invited_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_support_sessions",
    )
    ended_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ended_support_sessions",
    )

    duration_minutes = models.PositiveIntegerField(default=30)

    class Meta:
        ordering = ["-invited_at"]

    def __str__(self):
        return f"{self.owner} -> {self.admin} ({self.status})"

    def activate(self):
        now = timezone.now()
        self.status = self.STATUS_ACTIVE
        self.started_at = now
        self.expires_at = now + timedelta(minutes=self.duration_minutes)
        self.save(update_fields=["status", "started_at", "expires_at"])

    def mark_declined(self):
        self.status = self.STATUS_DECLINED
        self.ended_at = timezone.now()
        self.save(update_fields=["status", "ended_at"])

    def mark_terminated(self, ended_by=None):
        self.status = self.STATUS_TERMINATED
        self.ended_at = timezone.now()
        if ended_by:
            self.ended_by = ended_by
            self.save(update_fields=["status", "ended_at", "ended_by"])
        else:
            self.save(update_fields=["status", "ended_at"])

    def mark_expired(self):
        self.status = self.STATUS_EXPIRED
        self.ended_at = timezone.now()
        self.save(update_fields=["status", "ended_at"])

    @property
    def is_live(self):
        if self.status != self.STATUS_ACTIVE:
            return False
        if not self.expires_at:
            return False
        return timezone.now() < self.expires_at