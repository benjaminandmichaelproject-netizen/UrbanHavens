from rest_framework import serializers
from .models import Report


class ReportCreateSerializer(serializers.ModelSerializer):
    """Used when a user submits a new report."""

    class Meta:
        model = Report
        fields = [
            "id",
            "category",
            "subject",
            "description",
            "contact_email",
            "reported_property",
            "reported_user",
            "reported_booking",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_description(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError(
                "Description must be at least 20 characters."
            )
        return value


class ReportAdminSerializer(serializers.ModelSerializer):
    """Used by admins to list / update reports."""

    reported_by_username = serializers.CharField(
        source="reported_by.username", read_only=True
    )

    property_name = serializers.CharField(
        source="reported_property.property_name", read_only=True
    )
    property_city = serializers.CharField(
        source="reported_property.city", read_only=True
    )
    property_region = serializers.CharField(
        source="reported_property.region", read_only=True
    )

    owner_name = serializers.SerializerMethodField()
    owner_phone = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id",
            "category",
            "subject",
            "description",
            "contact_email",
            "reported_property",
            "reported_user",
            "reported_booking",
            "reported_by",
            "reported_by_username",
            "property_name",
            "property_city",
            "property_region",
            "owner_name",
            "owner_phone",
            "owner_email",
            "status",
            "admin_notes",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reported_by", "created_at"]

    def get_owner_name(self, obj):
        prop = obj.reported_property
        if not prop:
            return None

        if getattr(prop, "owner_name", None):
            return prop.owner_name

        owner = getattr(prop, "owner", None)
        if owner:
            full_name = f"{getattr(owner, 'first_name', '')} {getattr(owner, 'last_name', '')}".strip()
            return full_name or getattr(owner, "username", None)

        return None

    def get_owner_phone(self, obj):
        prop = obj.reported_property
        if not prop:
            return None

        if getattr(prop, "owner_phone", None):
            return prop.owner_phone

        owner = getattr(prop, "owner", None)
        if owner:
            return getattr(owner, "phone", None)

        return None

    def get_owner_email(self, obj):
        prop = obj.reported_property
        if not prop:
            return None

        if getattr(prop, "owner_email", None):
            return prop.owner_email

        owner = getattr(prop, "owner", None)
        if owner:
            return getattr(owner, "email", None)

        return None