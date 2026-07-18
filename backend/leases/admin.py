from django.contrib import admin

from .models import (
    LeaseRenewalRequest,
    TenantLease,
)


@admin.register(TenantLease)
class TenantLeaseAdmin(admin.ModelAdmin):
    # Displays the main lease information.
    list_display = (
        "id",
        "tenant",
        "property",
        "status",
        "lease_start_date",
        "lease_end_date",
    )

    # Allows filtering by lease status.
    list_filter = (
        "status",
    )

    # Enables searching for leases.
    search_fields = (
        "tenant__username",
        "tenant__email",
        "property__property_name",
    )


@admin.register(LeaseRenewalRequest)
class LeaseRenewalRequestAdmin(admin.ModelAdmin):
    # Displays renewal request information.
    list_display = (
        "id",
        "tenant",
        "property",
        "requested_duration_months",
        "expected_amount",
        "status",
        "created_at",
    )

    # Filters renewal requests.
    list_filter = (
        "status",
        "created_at",
    )

    # Allows searching.
    search_fields = (
        "tenant__username",
        "tenant__email",
        "landlord__username",
        "landlord__email",
        "property__property_name",
    )

    # Prevents editing audit fields.
    readonly_fields = (
        "created_at",
        "updated_at",
        "approved_at",
        "rejected_at",
        "cancelled_at",
    )

    # Optimizes database queries.
    list_select_related = (
        "tenant",
        "landlord",
        "property",
        "room",
        "current_lease",
    )

    # Shows newest requests first.
    ordering = (
        "-created_at",
    )