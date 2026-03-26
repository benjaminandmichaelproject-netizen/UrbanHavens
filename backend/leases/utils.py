from .models import TenantLease


def sync_property_availability(property_obj):
    active_lease_exists = TenantLease.objects.filter(
        property=property_obj,
        status="active",
    ).exists()

    property_obj.is_available = (
        property_obj.approval_status == "approved" and not active_lease_exists
    )
    property_obj.save(update_fields=["is_available"])