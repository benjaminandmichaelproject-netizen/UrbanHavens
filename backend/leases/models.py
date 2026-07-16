import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from bookings.models import Booking
from properties.models import Property, Room


class TenantLease(models.Model):
    # Defines the first payment states for a lease.
    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("partial", "Partial"),
        ("paid", "Paid"),
    ]

    # Defines the valid lease lifecycle states.
    STATUS_CHOICES = [
        ("active", "Active"),
        ("ended", "Ended"),
        ("cancelled", "Cancelled"),
    ]

    # Links one booking to one tenant lease.
    booking = models.OneToOneField(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_lease",
    )

    # Stores the leased property.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="leases",
    )

    # Stores the tenant attached to the lease.
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="tenant_leases",
    )

    # Stores the registered property owner.
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="landlord_leases",
    )

    # Stores the selected hostel room when applicable.
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leases",
    )

    # Stores the official lease dates.
    lease_start_date = models.DateField()
    lease_end_date = models.DateField()
    move_in_date = models.DateField()

    # Stores the agreed monthly rent.
    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Stores the agreed security deposit.
    deposit_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    # Tracks the tenant's first payment position.
    first_payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="pending",
    )

    # Stores optional lease notes.
    notes = models.TextField(
        blank=True,
        null=True,
    )

    # Tracks whether the lease is active, ended, or cancelled.
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active",
        db_index=True,
    )

    # Stores the unique official agreement number.
    agreement_number = models.CharField(
        max_length=40,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        editable=False,
    )

    # Records when the agreement became available.
    agreement_generated_at = models.DateTimeField(
        null=True,
        blank=True,
        editable=False,
    )

    # Records when the lease was created.
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        # Displays the newest leases first.
        ordering = ["-created_at"]

        # Improves common tenant, landlord, and property queries.
        indexes = [
            models.Index(
                fields=["tenant", "status"],
            ),
            models.Index(
                fields=["landlord", "status"],
            ),
            models.Index(
                fields=["property", "status"],
            ),
            models.Index(
                fields=["room", "status"],
            ),
        ]

        # Prevents duplicate active leases for one booking.
        constraints = [
            models.UniqueConstraint(
                fields=["booking"],
                condition=models.Q(
                    booking__isnull=False,
                ),
                name="unique_lease_per_booking",
            ),
        ]

    # Returns the assigned hostel room number.
    def get_room_number(self):
        return self.room.room_number if self.room else None

    # Generates a unique agreement reference.
    def generate_agreement_number(self):
        date_part = timezone.localdate().strftime("%Y%m%d")

        while True:
            token = uuid.uuid4().hex[:8].upper()

            agreement_number = f"UH-AGR-{date_part}-{token}"

            if not TenantLease.objects.filter(
                agreement_number=agreement_number
            ).exists():
                return agreement_number

    # Validates all lease relationships and dates.
    def clean(self):
        super().clean()

        errors = {}

        # Prevents invalid lease date ranges.
        if (
            self.lease_start_date
            and self.lease_end_date
            and self.lease_end_date < self.lease_start_date
        ):
            errors["lease_end_date"] = (
                "Lease end date cannot be earlier " "than lease start date."
            )

        # Prevents move-in before the lease begins.
        if (
            self.move_in_date
            and self.lease_start_date
            and self.move_in_date < self.lease_start_date
        ):
            errors["move_in_date"] = (
                "Move-in date cannot be earlier " "than lease start date."
            )

        # Prevents negative rent values.
        if self.monthly_rent is not None and self.monthly_rent < 0:
            errors["monthly_rent"] = "Monthly rent cannot be negative."

        # Prevents negative deposit values.
        if self.deposit_amount is not None and self.deposit_amount < 0:
            errors["deposit_amount"] = "Deposit amount cannot be negative."

        if self.booking_id:
            # Ensures the booking property matches the lease.
            if self.property_id and self.booking.property_id != self.property_id:
                errors["booking"] = (
                    "Selected booking does not belong " "to the selected property."
                )

            # Ensures the booking tenant matches the lease.
            if self.tenant_id and self.booking.tenant_id != self.tenant_id:
                errors["tenant"] = (
                    "Selected tenant does not match " "the booking tenant."
                )

            # Ensures the booking owner matches the landlord.
            if self.landlord_id and self.booking.owner_id != self.landlord_id:
                errors["landlord"] = (
                    "Selected landlord does not match " "the booking owner."
                )

            # Allows lease creation only after payment completion.
            if self.booking.status not in [
                "payment_completed",
                "converted",
            ]:
                errors["booking"] = (
                    "A lease can only be created after " "payment has been completed."
                )

        if self.property_id:
            # Requires a valid room for hostel leases.
            if self.property.category == "hostel":
                if not self.room_id:
                    errors["room"] = "A room is required for hostel leases."

                elif self.room and self.room.property_id != self.property_id:
                    errors["room"] = (
                        "Selected room does not belong "
                        "to the selected hostel property."
                    )

            # Prevents room assignment for house rentals.
            elif self.property.category == "house_rent":
                if self.room_id:
                    errors["room"] = "House rentals should not have " "a room assigned."

        # Ensures the landlord owns the property.
        if self.property_id and self.landlord_id:
            if self.property.owner_id and self.property.owner_id != self.landlord_id:
                errors["landlord"] = (
                    "Landlord must match the property's " "registered owner."
                )

        if errors:
            raise ValidationError(errors)

    # Validates the lease and creates agreement metadata.
    def save(self, *args, **kwargs):
        generated_fields = []

        # Creates an agreement number only once.
        if not self.agreement_number:
            self.agreement_number = self.generate_agreement_number()
            generated_fields.append("agreement_number")

        # Records agreement generation only once.
        if not self.agreement_generated_at:
            self.agreement_generated_at = timezone.now()
            generated_fields.append("agreement_generated_at")

        # Preserves generated fields during partial saves.
        update_fields = kwargs.get("update_fields")

        if update_fields is not None:
            kwargs["update_fields"] = list(set(update_fields) | set(generated_fields))

        self.full_clean()

        super().save(*args, **kwargs)

    # Returns a readable lease description.
    def __str__(self):
        room_text = f" (Room {self.room.room_number})" if self.room else ""

        return f"{self.tenant} - " f"{self.property}" f"{room_text}"


class LeaseRenewalRequest(models.Model):
    # Defines the valid renewal workflow states.
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("payment_pending", "Payment Pending"),
        ("payment_completed", "Payment Completed"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("cancelled", "Cancelled"),
    ]

    # Links the request to the lease being renewed.
    current_lease = models.ForeignKey(
        TenantLease,
        on_delete=models.PROTECT,
        related_name="renewal_requests",
    )

    # Stores the tenant requesting the renewal.
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tenant_renewal_requests",
    )

    # Stores the landlord responsible for approval.
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="landlord_renewal_requests",
    )

    # Stores the property linked to the renewal.
    property = models.ForeignKey(
        Property,
        on_delete=models.PROTECT,
        related_name="lease_renewal_requests",
    )

    # Preserves the tenant's current hostel room where applicable.
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lease_renewal_requests",
    )

    # Stores the approved renewal duration selected by the tenant.
    requested_duration_months = models.PositiveIntegerField()

    # Stores the first date of the renewed lease period.
    proposed_start_date = models.DateField()

    # Stores the calculated end date of the renewed lease period.
    proposed_end_date = models.DateField()

    # Stores the trusted monthly rent used for this renewal.
    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Stores the total renewal amount expected from the tenant.
    expected_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Links the renewal to its payment when payment is initialized.
    payment = models.OneToOneField(
        "payments.Payment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="lease_renewal_request",
    )

    # Tracks the current stage of the renewal request.
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="pending",
        db_index=True,
    )

    # Stores optional notes submitted with the renewal.
    notes = models.TextField(
        blank=True,
        default="",
        max_length=2000,
    )

    # Records when the landlord approved the renewal.
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Records when the renewal was rejected.
    rejected_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Records when the request was cancelled.
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Records when the renewal request was created.
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    # Records the latest renewal update.
    updated_at = models.DateTimeField(
        auto_now=True,
    )


class Meta:
    # Displays the newest renewal requests first.
    ordering = ["-created_at"]

    # Improves common owner, tenant, and status queries.
    indexes = [
        models.Index(
            fields=["tenant", "status"],
        ),
        models.Index(
            fields=["landlord", "status"],
        ),
        models.Index(
            fields=["current_lease", "status"],
        ),
        models.Index(
            fields=["property", "status"],
        ),
    ]

    # Prevents multiple open renewals for the same lease.
    constraints = [
        models.UniqueConstraint(
            fields=["current_lease"],
            condition=models.Q(
                status__in=[
                    "pending",
                    "payment_pending",
                    "payment_completed",
                ]
            ),
            name="unique_open_renewal_per_lease",
        ),
    ]

    # Validates renewal ownership, dates, duration, and property relations.
    def clean(self):
        super().clean()

        errors = {}

        if self.current_lease_id:
            current_lease = self.current_lease

            # Ensures the renewal tenant matches the current lease.
            if self.tenant_id and current_lease.tenant_id != self.tenant_id:
                errors["tenant"] = (
                    "Renewal tenant must match the current " "lease tenant."
                )

                # Ensures the renewal landlord matches the current lease.
                if self.landlord_id and current_lease.landlord_id != self.landlord_id:
                    errors["landlord"] = (
                        "Renewal landlord must match the current " "lease landlord."
                    )

                    # Ensures the renewal property matches the current lease.
                    if (
                        self.property_id
                        and current_lease.property_id != self.property_id
                    ):
                        errors["property"] = (
                            "Renewal property must match the current " "lease property."
                        )

                        # Ensures the renewal room matches the existing hostel room.
                        if (
                            current_lease.room_id
                            and self.room_id
                            and current_lease.room_id != self.room_id
                        ):
                            errors["room"] = (
                                "Renewal room must match the tenant's "
                                "current hostel room."
                            )

                            # Prevents attaching a room to a house renewal.
                            if not current_lease.room_id and self.room_id:
                                errors["room"] = (
                                    "A house renewal cannot have a hostel room."
                                )

                                # Requires the renewal to begin after the current lease.
                                if (
                                    self.proposed_start_date
                                    and current_lease.lease_end_date
                                    and self.proposed_start_date
                                    <= current_lease.lease_end_date
                                ):
                                    errors["proposed_start_date"] = (
                                        "The renewed lease must start after the "
                                        "current lease ends."
                                    )

                                    # Prevents invalid renewal date ranges.
                                    if (
                                        self.proposed_start_date
                                        and self.proposed_end_date
                                        and self.proposed_end_date
                                        < self.proposed_start_date
                                    ):
                                        errors["proposed_end_date"] = (
                                            "Renewal end date cannot be earlier than "
                                            "the renewal start date."
                                        )

                                        # Prevents invalid renewal durations.
                                        if (
                                            self.requested_duration_months is not None
                                            and self.requested_duration_months < 1
                                        ):
                                            errors["requested_duration_months"] = (
                                                "Renewal duration must be at least one month."
                                            )

                                            # Restricts renewal duration to owner-approved options.
                                            if self.property_id:
                                                try:
                                                    allowed_durations = [
                                                        int(months)
                                                        for months in (
                                                            self.property.allowed_rental_months
                                                            or []
                                                        )
                                                    ]
                                                except (TypeError, ValueError):
                                                    allowed_durations = []

                                                    if (
                                                        self.requested_duration_months
                                                        and self.requested_duration_months
                                                        not in allowed_durations
                                                    ):
                                                        errors[
                                                            "requested_duration_months"
                                                        ] = (
                                                            "The selected renewal duration is not "
                                                            "approved for this property."
                                                        )

                                                        # Prevents negative rent values.
                                                        if (
                                                            self.monthly_rent
                                                            is not None
                                                            and self.monthly_rent < 0
                                                        ):
                                                            errors["monthly_rent"] = (
                                                                "Monthly rent cannot be negative."
                                                            )

                                                            # Prevents negative expected amounts.
                                                            if (
                                                                self.expected_amount
                                                                is not None
                                                                and self.expected_amount
                                                                < 0
                                                            ):
                                                                errors[
                                                                    "expected_amount"
                                                                ] = "Expected renewal amount cannot be negative."

                                                                # Confirms the expected amount matches trusted rent values.
                                                                if (
                                                                    self.monthly_rent
                                                                    is not None
                                                                    and self.requested_duration_months
                                                                    and self.expected_amount
                                                                    is not None
                                                                ):
                                                                    calculated_amount = (
                                                                        self.monthly_rent
                                                                        * self.requested_duration_months
                                                                    )

                                                                    if (
                                                                        self.expected_amount
                                                                        != calculated_amount
                                                                    ):
                                                                        errors[
                                                                            "expected_amount"
                                                                        ] = (
                                                                            "Expected amount must equal monthly rent "
                                                                            "multiplied by the renewal duration."
                                                                        )

                                                                        if errors:
                                                                            raise ValidationError(
                                                                                errors
                                                                            )

                                                                        # Validates every renewal before saving.

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

        # Returns a readable renewal description.

    def __str__(self):
        return (
            f"Renewal for Lease #{self.current_lease_id} - "
            f"{self.requested_duration_months} months - "
            f"{self.status}"
        )
