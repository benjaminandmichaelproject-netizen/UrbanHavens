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

    # 👇 PROPERTY DETAILS
    property_name   = serializers.CharField(
        source="reported_property.property_name", read_only=True
    )
    property_city   = serializers.CharField(
        source="reported_property.city", read_only=True
    )
    property_region = serializers.CharField(
        source="reported_property.region", read_only=True
    )

    # 👇 OWNER DETAILS
    owner_name  = serializers.SerializerMethodField()
    owner_phone = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()

    class Meta:
        model  = Report
        fields = [
            "id",
            "category",
            "subject",
            "description",
            "contact_email",
            "reported_property",
            "reported_user",
            "reported_booking",
            "reported_by_username",

            # property
            "property_name",
            "property_city",
            "property_region",

            # owner
            "owner_name",
            "owner_phone",
            "owner_email",

            "status",
            "admin_notes",
            "created_at",
            "updated_at",
        ]

        read_only_fields = ["id", "reported_by", "created_at"]

    # -------------------------
    # OWNER RESOLUTION LOGIC
    # -------------------------

    def get_owner_name(self, obj):
        property_obj = obj.reported_property
        if not property_obj:
            return None

        if property_obj.owner:
            return property_obj.owner_name  # already computed in Property model

        if property_obj.external_landlord:
            return property_obj.external_landlord.full_name

        return None

    def get_owner_phone(self, obj):
        property_obj = obj.reported_property
        if not property_obj:
            return None

        if property_obj.owner:
            return property_obj.owner_phone

        if property_obj.external_landlord:
            return property_obj.external_landlord.phone

        return None

    def get_owner_email(self, obj):
        property_obj = obj.reported_property
        if not property_obj:
            return None

        if property_obj.owner:
            return property_obj.owner_email

        if property_obj.external_landlord:
            return property_obj.external_landlord.email

        return None