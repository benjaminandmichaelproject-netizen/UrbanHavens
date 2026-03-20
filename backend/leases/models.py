from django.db import models

# Create your models here.
from django.conf import settings
from django.db import models
from properties.models import Property
from bookings.models import Booking


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
        related_name="tenant_lease"
    )

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="leases"
    )

    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenant_leases"
    )

    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="landlord_leases"
    )

    lease_start_date = models.DateField()
    lease_end_date = models.DateField()
    move_in_date = models.DateField()

    monthly_rent = models.DecimalField(max_digits=12, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    first_payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="pending"
    )

    notes = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tenant} - {self.property}"