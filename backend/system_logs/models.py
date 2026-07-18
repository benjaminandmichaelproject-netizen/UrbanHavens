from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class SystemLog(models.Model):
    """
    A unified log record for every significant event in the system.

    Covers SMS attempts, API errors, booking lifecycle events,
    property lifecycle events, meeting events, and notification dispatches.
    Each record captures enough context to diagnose problems without
    digging through server logs.
    """

    # --- Category choices -------------------------------------------------
    class Category(models.TextChoices):
        SMS = "sms", "SMS"
        API_ERROR = "api_error", "API Error"
        BOOKING = "booking", "Booking"
        NOTIFICATION = "notification", "Notification"
        MEETING = "meeting", "Meeting"
        PROPERTY = "property", "Property"

    # --- Status choices ---------------------------------------------------
    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"
        INFO = "info", "Info"

    # Core fields
    category = models.CharField(max_length=20, choices=Category.choices)
    status = models.CharField(max_length=10, choices=Status.choices)
    message = models.TextField()                         # human-readable summary
    detail = models.TextField(blank=True, default="")   # stack trace / raw response
    created_at = models.DateTimeField(auto_now_add=True)

    # Optional context fields — filled in where available
    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="system_logs",
    )
    booking_id = models.IntegerField(null=True, blank=True)
    meeting_id = models.IntegerField(null=True, blank=True)
    property_id = models.IntegerField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    endpoint = models.CharField(max_length=255, blank=True, default="")
    status_code = models.IntegerField(null=True, blank=True)  # for API errors

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.category}] {self.status} — {self.message[:60]}"