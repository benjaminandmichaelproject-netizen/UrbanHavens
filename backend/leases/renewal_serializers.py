import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import (
    LeaseRenewalRequest,
    TenantLease,
)


# Adds a fixed number of months without producing invalid dates.
def add_months(start_date, months):
    month_index = start_date.month - 1 + months
    year = start_date.year + month_index // 12
    month = month_index % 12 + 1

    day = min(
        start_date.day,
        calendar.monthrange(year, month)[1],
    )

    return start_date.replace(
        year=year,
        month=month,
        day=day,
    )


class LeaseRenewalRequestSerializer(
    serializers.ModelSerializer
):
    # Returns readable related-record details.
    property_name = serializers.CharField(
        source="property.property_name",
        read_only=True,
    )

    tenant_name = serializers.SerializerMethodField()
    landlord_name = serializers.SerializerMethodField()

    room_number = serializers.CharField(
        source="room.room_number",
        read_only=True,
        allow_null=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = LeaseRenewalRequest

        fields = [
            "id",
            "current_lease",
            "tenant",
            "tenant_name",
            "landlord",
            "landlord_name",
            "property",
            "property_name",
            "room",
            "room_number",
            "requested_duration_months",
            "proposed_start_date",
            "proposed_end_date",
            "monthly_rent",
            "expected_amount",
            "status",
            "status_display",
            "notes",
            "approved_at",
            "rejected_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]

        # Prevents clients from changing server-controlled values.
        read_only_fields = [
            "id",
            "tenant",
            "tenant_name",
            "landlord",
            "landlord_name",
            "property",
            "property_name",
            "room",
            "room_number",
            "proposed_start_date",
            "proposed_end_date",
            "monthly_rent",
            "expected_amount",
            "status",
            "status_display",
            "approved_at",
            "rejected_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]

    # Returns the tenant's safest readable name.
    def get_tenant_name(self, obj):
        full_name = obj.tenant.get_full_name().strip()

        return (
            full_name
            or obj.tenant.username
            or obj.tenant.email
        )

    # Returns the landlord's safest readable name.
    def get_landlord_name(self, obj):
        full_name = obj.landlord.get_full_name().strip()

        return (
            full_name
            or obj.landlord.username
            or obj.landlord.email
        )


class CreateLeaseRenewalRequestSerializer(
    serializers.Serializer
):
    # Identifies the active lease being renewed.
    current_lease_id = serializers.IntegerField(
        min_value=1,
    )

    # Accepts an owner-approved rental duration.
    requested_duration_months = serializers.IntegerField(
        min_value=1,
    )

    # Stores an optional tenant note.
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=2000,
    )

    # Validates tenant ownership and renewal eligibility.
    def validate(self, attrs):
        request = self.context.get("request")

        if (
            not request
            or not request.user.is_authenticated
        ):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Authentication is required."
                    )
                }
            )

        lease_id = attrs["current_lease_id"]
        duration = attrs[
            "requested_duration_months"
        ]

        try:
            # Loads only a lease belonging to this tenant.
            lease = (
                TenantLease.objects.select_related(
                    "property",
                    "tenant",
                    "landlord",
                    "room",
                )
                .get(
                    id=lease_id,
                    tenant=request.user,
                )
            )
        except TenantLease.DoesNotExist:
            raise serializers.ValidationError(
                {
                    "current_lease_id": (
                        "Lease not found or does not "
                        "belong to you."
                    )
                }
            )

        # Allows renewal only for a currently active lease.
        if lease.status != "active":
            raise serializers.ValidationError(
                {
                    "current_lease_id": (
                        "Only an active lease can be renewed."
                    )
                }
            )

        today = date.today()
        renewal_open_date = (
            lease.lease_end_date
            - timedelta(days=30)
        )

        # Opens renewal during the final 30 days.
        if today < renewal_open_date:
            raise serializers.ValidationError(
                {
                    "current_lease_id": (
                        "Renewal becomes available "
                        "30 days before the lease ends."
                    )
                }
            )

        # Prevents requests after the lease has expired.
        if today > lease.lease_end_date:
            raise serializers.ValidationError(
                {
                    "current_lease_id": (
                        "This lease has already expired."
                    )
                }
            )

        try:
            # Reads the owner's approved duration options.
            allowed_durations = [
                int(months)
                for months in (
                    lease.property.allowed_rental_months
                    or []
                )
            ]
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                {
                    "requested_duration_months": (
                        "The property's approved rental "
                        "durations are invalid."
                    )
                }
            )

        if duration not in allowed_durations:
            raise serializers.ValidationError(
                {
                    "requested_duration_months": (
                        "Select one of the rental durations "
                        "approved by the owner."
                    )
                }
            )

        # Prevents duplicate unfinished requests.
        if LeaseRenewalRequest.objects.filter(
            current_lease=lease,
            status__in=[
                "pending",
                "payment_pending",
                "payment_completed",
            ],
        ).exists():
            raise serializers.ValidationError(
                {
                    "current_lease_id": (
                        "An open renewal request already "
                        "exists for this lease."
                    )
                }
            )

        # Uses trusted lease rent, not a client amount.
        monthly_rent = Decimal(
            str(lease.monthly_rent)
        )

        expected_amount = (
            monthly_rent
            * Decimal(str(duration))
        ).quantize(
            Decimal("0.01")
        )

        # Starts the renewed period after the old lease ends.
        proposed_start_date = (
            lease.lease_end_date
            + timedelta(days=1)
        )

        proposed_end_date = (
            add_months(
                proposed_start_date,
                duration,
            )
            - timedelta(days=1)
        )

        # Passes trusted values into create().
        attrs["_resolved_lease"] = lease
        attrs["_monthly_rent"] = monthly_rent
        attrs["_expected_amount"] = expected_amount
        attrs["_proposed_start_date"] = (
            proposed_start_date
        )
        attrs["_proposed_end_date"] = (
            proposed_end_date
        )

        return attrs

    # Creates the request without changing the active lease.
    def create(self, validated_data):
        lease = validated_data.pop(
            "_resolved_lease"
        )
        monthly_rent = validated_data.pop(
            "_monthly_rent"
        )
        expected_amount = validated_data.pop(
            "_expected_amount"
        )
        proposed_start_date = validated_data.pop(
            "_proposed_start_date"
        )
        proposed_end_date = validated_data.pop(
            "_proposed_end_date"
        )

        validated_data.pop(
            "current_lease_id"
        )

        with transaction.atomic():
            # Locks the lease against duplicate requests.
            locked_lease = (
                TenantLease.objects
                .select_for_update()
                .select_related(
                    "property",
                    "tenant",
                    "landlord",
                    "room",
                )
                .get(pk=lease.pk)
            )

            # Rechecks duplicate requests while locked.
            if LeaseRenewalRequest.objects.filter(
                current_lease=locked_lease,
                status__in=[
                    "pending",
                    "payment_pending",
                    "payment_completed",
                ],
            ).exists():
                raise serializers.ValidationError(
                    {
                        "current_lease_id": (
                            "An open renewal request "
                            "already exists."
                        )
                    }
                )

            renewal = LeaseRenewalRequest.objects.create(
                current_lease=locked_lease,
                tenant=locked_lease.tenant,
                landlord=locked_lease.landlord,
                property=locked_lease.property,
                room=locked_lease.room,
                requested_duration_months=(
                    validated_data[
                        "requested_duration_months"
                    ]
                ),
                proposed_start_date=(
                    proposed_start_date
                ),
                proposed_end_date=(
                    proposed_end_date
                ),
                monthly_rent=monthly_rent,
                expected_amount=expected_amount,
                status="pending",
                notes=validated_data.get(
                    "notes",
                    "",
                ).strip(),
            )

        return renewal