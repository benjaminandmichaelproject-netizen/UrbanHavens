from rest_framework import serializers
from .models import TenantLease


class TenantLeaseSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.username", read_only=True)
    property_name = serializers.CharField(source="property.property_name", read_only=True)

    class Meta:
        model = TenantLease
        fields = [
            "id",
            "booking",
            "property",
            "property_name",
            "tenant",
            "tenant_name",
            "landlord",
            "lease_start_date",
            "lease_end_date",
            "move_in_date",
            "monthly_rent",
            "deposit_amount",
            "first_payment_status",
            "notes",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "landlord",
            "tenant_name",
            "property_name",
            "status",
            "created_at",
        ]