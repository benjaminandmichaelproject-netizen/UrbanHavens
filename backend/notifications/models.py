from django.conf import settings
from django.db import models


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ("inspection_request", "Inspection Request"),
        ("inspection_confirmed", "Inspection Confirmed"),
        ("property_booked", "Property Booked"),
        ("property_submitted", "Property Submitted"),
        ("property_approved", "Property Approved"),
        ("property_rejected", "Property Rejected"),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)

    is_read = models.BooleanField(default=False)

    # optional but powerful
    related_property_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.recipient} - {self.notification_type}"