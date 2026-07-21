import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from bookings.models import Booking
from properties.models import Property, Room


class OwnerPaymentAccount(models.Model):
    # Defines the supported owner settlement account providers.
    PROVIDER_CHOICES = (
        ("mtn", "MTN Mobile Money"),
        ("telecel", "Telecel Cash"),
        ("airteltigo", "AirtelTigo Money"),
        ("bank", "Bank Account"),
    )

    # Links one settlement account to one property owner.
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_account",
    )

    # Stores the settlement account holder's name.
    account_name = models.CharField(
        max_length=150,
    )

    # Stores and validates a Ghana mobile money number.
    phone_number = models.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                regex=r"^0\d{9}$",
                message=(
                    "Enter a valid Ghana phone number. "
                    "Example: 0541254645"
                ),
            ) 
        ],
        help_text="Mobile money number",
    )

    # Stores the selected settlement provider.
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
    )

    # Stores the server-created Paystack subaccount reference.
    paystack_subaccount_code = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    # Tracks whether the settlement account is verified and usable.
    is_verified = models.BooleanField(
        default=False,
    )
    is_active = models.BooleanField(
        default=True,
    )

    # Stores only the final digits for safe account display.
    last_four_digits = models.CharField(
        max_length=4,
        blank=True,
    )

    # Records when the account was created and updated.
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        verbose_name = "Owner Payment Account"
        verbose_name_plural = "Owner Payment Accounts"

    # Updates the masked phone digits before saving.
    def save(self, *args, **kwargs):
        if self.phone_number:
            self.last_four_digits = self.phone_number[-4:]

        super().save(*args, **kwargs)

    # Returns a protected settlement account description.
    def __str__(self):
        return (
            f"{self.owner} - "
            f"{self.provider} - "
            f"****{self.last_four_digits}"
        )


class Payment(models.Model):
    # Defines what the tenant is paying for.
    PAYMENT_TYPE_CHOICES = (
        ("rent", "Rent"),
        ("deposit", "Deposit"),
        ("rent_and_deposit", "Rent and Deposit"),
        ("renewal", "Lease Renewal"),
    )

    # Defines the supported payment channels.
    PAYMENT_METHOD_CHOICES = (
        ("paystack", "Pay through UrbanHavens"),
        ("direct", "Pay Owner Directly"),
    )

    # Defines the valid payment processing states.
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("success", "Success"),
        ("failed", "Failed"),
        ("abandoned", "Abandoned"),
        ("refunded", "Refunded"),
    )

    # Defines whether the received amount fully covers the expected amount.
    PAYMENT_COMPLETION_STATUS_CHOICES = (
        ("unpaid", "Unpaid"),
        ("part", "Part Payment"),
        ("full", "Full Payment"),
        ("overpaid", "Overpaid"),
    )

    # Defines the valid owner settlement states.
    SETTLEMENT_STATUS_CHOICES = (
        (
            "not_applicable",
            "Not Applicable",
        ),
        (
            "pending",
            "Awaiting Paystack Settlement",
        ),
        (
            "processing",
            "Settlement Processing",
        ),
        (
            "paid",
            "Paid to Owner",
        ),
        (
            "failed",
            "Settlement Failed",
        ),
    )

    # Stores the tenant making the payment.
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tenant_payments",
    )

    # Stores the landlord receiving the payment.
    landlord = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="landlord_payments",
    )

    # Links a first-time rental payment to one booking.
    booking = models.OneToOneField(
        Booking,
        on_delete=models.PROTECT,
        related_name="payment",
        null=True,
        blank=True,
    )

    # Links a renewal payment to one approved lease-renewal request.
    renewal_request = models.OneToOneField(
        "leases.LeaseRenewalRequest",
        on_delete=models.PROTECT,
        related_name="renewal_payment",
        null=True,
        blank=True,
    )

    # Stores the property attached to the payment.
    property = models.ForeignKey(
        Property,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    # Stores the selected hostel room when the property is a hostel.
    room = models.ForeignKey(
        Room,
        on_delete=models.PROTECT,
        related_name="payments",
        null=True,
        blank=True,
    )

    # Stores whether the payment covers rent, deposit, or both.
    payment_type = models.CharField(
        max_length=30,
        choices=PAYMENT_TYPE_CHOICES,
        default="rent_and_deposit",
    )

    # Stores the selected payment channel.
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        default="paystack",
    )

    # Stores the approved rental duration.
    duration_months = models.PositiveIntegerField(
        default=6,
    )

    # Stores the original payment amount used by the payment workflow.
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Creates a unique server-controlled payment reference.
    reference = models.CharField(
        max_length=120,
        unique=True,
        db_index=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Stores Paystack initialization details.
    paystack_access_code = models.CharField(
        max_length=120,
        blank=True,
    )
    paystack_authorization_url = models.URLField(
        blank=True,
    )

    # Tracks the payment processing state.
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        db_index=True,
    )

    # Stores the expected amount used to classify the receipt.
    expected_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    # Stores the amount Paystack verified or the owner confirmed receiving.
    amount_received = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    # Stores whether the payment is unpaid, part, full, or overpaid.
    payment_completion_status = models.CharField(
        max_length=20,
        choices=PAYMENT_COMPLETION_STATUS_CHOICES,
        default="unpaid",
        db_index=True,
    )

    # Stores the remaining amount after the confirmed payment.
    outstanding_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    # Stores the unique official receipt number after confirmation.
    receipt_number = models.CharField(
        max_length=40,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )

    # Records when the official receipt became available.
    receipt_generated_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    # Tracks whether and how the owner has been settled.
    settlement_status = models.CharField(
        max_length=30,
        choices=SETTLEMENT_STATUS_CHOICES,
        default="not_applicable",
        db_index=True,
    )

    # Stores UrbanHavens' commission amount.
    platform_commission = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="UrbanHavens commission amount.",
    )

    # Stores the transaction fee charged by Paystack.
    paystack_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Transaction fee charged by Paystack.",
    )

    # Stores the amount expected to reach the owner.
    owner_net_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text=(
            "Amount expected to be settled "
            "to the property owner."
        ),
    )

    # Stores settlement tracking references.
    settlement_reference = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )
    settlement_id = models.CharField(
        max_length=120,
        blank=True,
        default="",
        db_index=True,
    )

    # Stores a masked settlement account reference.
    settlement_account = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text=(
            "Masked settlement account or "
            "subaccount reference."
        ),
    )

    # Stores the settlement provider response.
    settlement_response = models.JSONField(
        blank=True,
        null=True,
    )

    # Records when settlement was completed.
    settled_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    # Stores the Paystack verification response.
    paystack_response = models.JSONField(
        blank=True,
        null=True,
    )

    # Records when the payment was verified.
    verified_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    # Records when the payment was created and updated.
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        # Displays the newest payments first.
        ordering = ["-created_at"]

        # Adds indexes for common payment, receipt, and settlement queries.
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
            models.Index(
                fields=["renewal_request", "status"],
            ),
            models.Index(
                fields=["status", "payment_completion_status"],
            ),
            models.Index(
                fields=[
                    "landlord",
                    "settlement_status",
                ],
            ),
            models.Index(
                fields=[
                    "payment_method",
                    "settlement_status",
                ],
            ),
        ]

        # Enforces exactly one source workflow for every payment.
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        Q(booking__isnull=False)
                        & Q(renewal_request__isnull=True)
                    )
                    | (
                        Q(booking__isnull=True)
                        & Q(renewal_request__isnull=False)
                    )
                ),
                name="payment_exactly_one_source",
            ),
        ]

    # Builds a unique human-readable receipt number.
    def _generate_receipt_number(self):
        date_part = timezone.localdate().strftime("%Y%m%d")

        while True:
            token = uuid.uuid4().hex[:8].upper()
            receipt_number = f"UH-RCP-{date_part}-{token}"

            if not Payment.objects.filter(
                receipt_number=receipt_number
            ).exists():
                return receipt_number

    # Calculates and stores the receipt classification and balance.
    def finalize_receipt(
        self,
        amount_received,
        expected_amount=None,
    ):
        received = Decimal(str(amount_received)).quantize(
            Decimal("0.01")
        )

        expected = Decimal(
            str(
                expected_amount
                if expected_amount is not None
                else self.amount
            )
        ).quantize(Decimal("0.01"))

        if expected <= Decimal("0.00"):
            raise ValidationError(
                {
                    "expected_amount": (
                        "Expected amount must be greater than zero."
                    )
                }
            )

        if received < Decimal("0.00"):
            raise ValidationError(
                {
                    "amount_received": (
                        "Amount received cannot be negative."
                    )
                }
            )

        if received == Decimal("0.00"):
            completion_status = "unpaid"
        elif received < expected:
            completion_status = "part"
        elif received == expected:
            completion_status = "full"
        else:
            completion_status = "overpaid"

        self.expected_amount = expected
        self.amount_received = received
        self.payment_completion_status = completion_status
        self.outstanding_balance = max(
            expected - received,
            Decimal("0.00"),
        )

        if not self.receipt_number:
            self.receipt_number = self._generate_receipt_number()

        if not self.receipt_generated_at:
            self.receipt_generated_at = timezone.now()

    # Validates payment relationships and receipt amounts.
    def clean(self):
        super().clean()

        errors = {}

        # Requires exactly one source: booking or renewal request.
        if not self.booking_id and not self.renewal_request_id:
            errors["booking"] = (
                "A payment must be linked to either a booking "
                "or a lease renewal request."
            )

        if self.booking_id and self.renewal_request_id:
            errors["booking"] = (
                "A payment cannot be linked to both a booking "
                "and a lease renewal request."
            )

        # Validates first-time booking payments.
        if self.booking_id:
            if self.payment_type == "renewal":
                errors["payment_type"] = (
                    "A booking payment cannot use the renewal "
                    "payment type."
                )

            if (
                self.property_id
                and self.booking.property_id != self.property_id
            ):
                errors["property"] = (
                    "The payment property must match the booking property."
                )

            if (
                self.tenant_id
                and self.booking.tenant_id != self.tenant_id
            ):
                errors["tenant"] = (
                    "The payment tenant must match the booking tenant."
                )

            if (
                self.landlord_id
                and self.booking.owner_id != self.landlord_id
            ):
                errors["landlord"] = (
                    "The payment landlord must match the booking owner."
                )

        # Validates lease-renewal payments.
        if self.renewal_request_id:
            renewal = self.renewal_request

            if self.payment_type != "renewal":
                errors["payment_type"] = (
                    "A lease-renewal payment must use the "
                    "renewal payment type."
                )

            if renewal.status not in [
                "payment_pending",
                "payment_completed",
                "approved",
            ]:
                errors["renewal_request"] = (
                    "The renewal request is not ready for payment."
                )

            if (
                self.property_id
                and renewal.property_id != self.property_id
            ):
                errors["property"] = (
                    "The payment property must match the "
                    "renewal property."
                )

            if (
                self.tenant_id
                and renewal.tenant_id != self.tenant_id
            ):
                errors["tenant"] = (
                    "The payment tenant must match the "
                    "renewal tenant."
                )

            if (
                self.landlord_id
                and renewal.landlord_id != self.landlord_id
            ):
                errors["landlord"] = (
                    "The payment landlord must match the "
                    "renewal landlord."
                )

            if renewal.room_id != self.room_id:
                errors["room"] = (
                    "The payment room must match the "
                    "renewal room."
                )

            if (
                self.duration_months
                != renewal.requested_duration_months
            ):
                errors["duration_months"] = (
                    "The payment duration must match the "
                    "approved renewal duration."
                )

            if (
                self.amount is not None
                and self.amount != renewal.expected_amount
            ):
                errors["amount"] = (
                    "The payment amount must match the "
                    "approved renewal amount."
                )

        if self.property_id:
            if self.property.category == "hostel":
                if not self.room_id:
                    errors["room"] = (
                        "A room is required for hostel payments."
                    )
            elif self.room_id:
                errors["room"] = (
                    "A room cannot be attached to a house payment."
                )

        if self.room_id and self.property_id:
            if self.room.property_id != self.property_id:
                errors["room"] = (
                    "The selected room does not belong to this property."
                )

        if self.expected_amount < Decimal("0.00"):
            errors["expected_amount"] = (
                "Expected amount cannot be negative."
            )

        if self.amount_received < Decimal("0.00"):
            errors["amount_received"] = (
                "Amount received cannot be negative."
            )

        if self.outstanding_balance < Decimal("0.00"):
            errors["outstanding_balance"] = (
                "Outstanding balance cannot be negative."
            )

        if errors:
            raise ValidationError(errors)

    # Runs relationship and receipt validation before saving.
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    # Returns a readable payment summary.
    def __str__(self):
        source = (
            f"Booking #{self.booking_id}"
            if self.booking_id
            else f"Renewal #{self.renewal_request_id}"
        )

        return (
            f"{self.reference} - "
            f"{source} - "
            f"{self.amount} - "
            f"{self.status} - "
            f"{self.settlement_status}"
        )
