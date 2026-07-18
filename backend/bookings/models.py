from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from properties.models import Property


class Booking(models.Model):
    # Defines the valid stages of a booking.
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("inspection_completed", "Inspection Completed"),
        ("payment_pending", "Payment Pending"),
        ("payment_completed", "Payment Completed"),
        ("converted", "Converted"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
    ]

    # Links the booking to the selected property.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="bookings",
    )

    # Stores the tenant who created the booking.
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenant_bookings",
    )

    # Stores the owner of the booked property.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owner_bookings",
    )

    # Stores the tenant's inspection contact details.
    phone = models.CharField(max_length=20)
    preferred_date = models.DateField()
    preferred_time = models.TimeField()
    message = models.TextField(blank=True, default="")

    # Tracks the current booking workflow stage.
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    # Controls whether each user has archived the booking.
    archived_by_owner = models.BooleanField(default=False)
    archived_by_tenant = models.BooleanField(default=False)

    # Records when the booking was created.
    created_at = models.DateTimeField(auto_now_add=True)


class InspectionMeeting(models.Model):
    # Defines the valid inspection meeting states.
    STATUS_CHOICES = [
        ("upcoming", "Upcoming"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    # Connects one inspection meeting to one booking.
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="meeting",
    )

    # Stores the inspection meeting details.
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=255)
    note = models.TextField(blank=True, default="")

    # Tracks the current inspection meeting state.
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="upcoming",
    )

    # Records when the meeting was created and updated.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Returns a readable inspection meeting description.
    def __str__(self):
        return (
            f"Meeting for Booking #{self.booking.id} "
            f"on {self.date} at {self.time}"
        )


class BookingIdempotencyKey(models.Model):
    # Stores the user who submitted the protected request.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="booking_idempotency_keys",
    )

    # Stores the unique key used to prevent duplicate bookings.
    key = models.CharField(max_length=255, unique=True)

    # Stores request and response details for safe request replay.
    endpoint = models.CharField(max_length=100, default="/api/bookings/")
    request_hash = models.CharField(max_length=64)
    response_status = models.PositiveIntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True)

    # Records when the idempotency key was created.
    created_at = models.DateTimeField(auto_now_add=True)

    # Displays the most recently created keys first.
    class Meta:
        ordering = ["-created_at"]

    # Returns a readable idempotency key description.
    def __str__(self):
        return f"{self.user} - {self.key}"