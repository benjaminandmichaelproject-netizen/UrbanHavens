from rest_framework import serializers
from .models import Report


class ReportCreateSerializer(serializers.ModelSerializer):
    """Used when a user submits a new report."""

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

    class Meta:
        model  = Report
        fields = "__all__"
        read_only_fields = ["id", "reported_by", "created_at"]