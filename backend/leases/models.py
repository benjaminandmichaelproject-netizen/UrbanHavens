from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from bookings.models import Booking
from properties.models import Property, Room


class TenantLease(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("partial", "Partial"),
        ("paid", "Paid"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("ended", "Ended"),
        ("cancelled", "Cancelled"),
    ]

    booking = models.OneToOneField(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_lease",
    )
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="leases",
    )
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenant_leases",
    )
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="landlord_leases",
    )

    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leases",
    )

    lease_start_date = models.DateField()
    lease_end_date = models.DateField()
    move_in_date = models.DateField()

    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    first_payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="pending",
    )
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def get_room_number(self):
        return self.room.room_number if self.room else None

    def clean(self):
        super().clean()

        if self.lease_end_date and self.lease_start_date:
            if self.lease_end_date < self.lease_start_date:
                raise ValidationError({
                    "lease_end_date": "Lease end date cannot be earlier than lease start date."
                })

        if self.move_in_date and self.lease_start_date:
            if self.move_in_date < self.lease_start_date:
                raise ValidationError({
                    "move_in_date": "Move-in date cannot be earlier than lease start date."
                })

        if self.booking_id:
            if self.booking.property_id != self.property_id:
                raise ValidationError({
                    "booking": "Selected booking does not belong to the selected property."
                })

            if self.booking.tenant_id != self.tenant_id:
                raise ValidationError({
                    "tenant": "Selected tenant does not match the booking tenant."
                })

        if self.property_id:
            if self.property.category == "hostel":
                if not self.room_id:
                    raise ValidationError({
                        "room": "A room is required for hostel leases."
                    })

                if self.room and self.room.property_id != self.property_id:
                    raise ValidationError({
                        "room": "Selected room does not belong to the selected hostel property."
                    })

            elif self.property.category == "house_rent":
                if self.room_id:
                    raise ValidationError({
                        "room": "House rentals should not have a room assigned."
                    })

        if self.property_id and self.landlord_id:
            if self.property.owner_id and self.property.owner_id != self.landlord_id:
                raise ValidationError({
                    "landlord": "Landlord must match the property's registered owner."
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        room_text = f" (Room {self.room.room_number})" if self.room else ""
        return f"{self.tenant} - {self.property}{room_text}"