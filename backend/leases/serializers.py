from rest_framework import serializers
from .models import TenantLease


class TenantLeaseSerializer(serializers.ModelSerializer):
    property_name     = serializers.CharField(source="property.property_name", read_only=True)
    property_city     = serializers.CharField(source="property.city",          read_only=True)
    property_region   = serializers.CharField(source="property.region",        read_only=True)
    property_type     = serializers.CharField(source="property.property_type", read_only=True)
    property_category = serializers.CharField(source="property.category",      read_only=True)
    property_images   = serializers.SerializerMethodField()

    tenant_name  = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)
    tenant_phone = serializers.CharField(source="tenant.phone",  read_only=True)

    landlord_name  = serializers.SerializerMethodField()
    landlord_email = serializers.EmailField(source="landlord.email", read_only=True)
    landlord_phone = serializers.CharField(source="landlord.phone",  read_only=True)

    class Meta:
        model = TenantLease
        fields = [
            "id", "booking",
            "property", "property_name", "property_city", "property_region",
            "property_type", "property_category", "property_images",
            "tenant", "tenant_name", "tenant_email", "tenant_phone",
            "landlord", "landlord_name", "landlord_email", "landlord_phone",
            "room_number",
            "lease_start_date", "lease_end_date", "move_in_date",
            "monthly_rent", "deposit_amount", "first_payment_status",
            "notes", "status", "created_at",
        ]
        read_only_fields = [
            "landlord",
            "tenant_name", "tenant_email", "tenant_phone",
            "landlord_name", "landlord_email", "landlord_phone",
            "property_name", "property_city", "property_region",
            "property_type", "property_category", "property_images",
            "status", "created_at",
        ]

    def get_property_images(self, obj):
        request = self.context.get("request")
        result = []
        for img in obj.property.images.all():
            if img.image:
                url = request.build_absolute_uri(img.image.url) if request else img.image.url
                result.append(url)
        return result

    def get_tenant_name(self, obj):
        if not obj.tenant:
            return "Unknown"
        full = f"{obj.tenant.first_name} {obj.tenant.last_name}".strip()
        return full or obj.tenant.username

    def get_landlord_name(self, obj):
        if not obj.landlord:
            return "Unknown"
        full = f"{obj.landlord.first_name} {obj.landlord.last_name}".strip()
        return full or obj.landlord.username