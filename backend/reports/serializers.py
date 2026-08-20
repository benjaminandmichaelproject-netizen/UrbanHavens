from django.utils import timezone
from rest_framework import serializers

from .models import Report


class ReportCreateSerializer(serializers.ModelSerializer):
    """Used when an authenticated user submits a new report."""

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
        read_only_fields = [
            "id",
            "created_at",
        ]

    # Prevents reports with extremely short or meaningless descriptions.
    def validate_description(self, value):
        if len(value.strip()) < 20:
            raise serializers.ValidationError(
                "Description must be at least 20 characters."
            )

        return value


class ReportAdminSerializer(serializers.ModelSerializer):
    """
    Used by admins to list and moderate reports.

    In addition to the report itself, this serializer exposes the
    related property's moderation state and owner information so the
    admin dashboard can display the full moderation context.
    """

    reported_by_username = serializers.CharField(
        source="reported_by.username",
        read_only=True,
    )

    # -------------------------------------------------------------- #
    # Property details                                               #
    # -------------------------------------------------------------- #

    property_name = serializers.CharField(
        source="reported_property.property_name",
        read_only=True,
    )

    property_city = serializers.CharField(
        source="reported_property.city",
        read_only=True,
    )

    property_region = serializers.CharField(
        source="reported_property.region",
        read_only=True,
    )

    # -------------------------------------------------------------- #
    # Property moderation details                                    #
    # -------------------------------------------------------------- #

    report_flag_status = serializers.SerializerMethodField()
    reported_count = serializers.SerializerMethodField()
    report_flag_reason_summary = serializers.SerializerMethodField()

    # -------------------------------------------------------------- #
    # Property owner details                                         #
    # -------------------------------------------------------------- #

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
            "reported_by_username",

            # Property details.
            "property_name",
            "property_city",
            "property_region",

            # Property moderation details.
            "report_flag_status",
            "reported_count",
            "report_flag_reason_summary",

            # Property owner details.
            "owner_name",
            "owner_phone",
            "owner_email",

            # Admin moderation details.
            "status",
            "admin_notes",
            "resolved_at",

            # Timestamps.
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "reported_by_username",
            "property_name",
            "property_city",
            "property_region",
            "report_flag_status",
            "reported_count",
            "report_flag_reason_summary",
            "owner_name",
            "owner_phone",
            "owner_email",
            "resolved_at",
            "created_at",
            "updated_at",
        ]

    # -------------------------------------------------------------- #
    # Property moderation helpers                                    #
    # -------------------------------------------------------------- #

    # Returns the current report-based moderation state of the property.
    def get_report_flag_status(self, obj):
        property_obj = obj.reported_property

        if not property_obj:
            return None

        return property_obj.report_flag_status

    # Returns the number of unique valid reports currently counted.
    def get_reported_count(self, obj):
        property_obj = obj.reported_property

        if not property_obj:
            return 0

        return property_obj.reported_count

    # Returns the backend-generated summary of the main report reasons.
    def get_report_flag_reason_summary(self, obj):
        property_obj = obj.reported_property

        if not property_obj:
            return ""

        return property_obj.report_flag_reason_summary or ""

    # -------------------------------------------------------------- #
    # Owner resolution helpers                                       #
    # -------------------------------------------------------------- #

    # Resolves the property owner's name for registered and external owners.
    def get_owner_name(self, obj):
        property_obj = obj.reported_property

        if not property_obj:
            return None

        if property_obj.owner:
            return property_obj.owner_name

        if property_obj.external_landlord:
            return property_obj.external_landlord.full_name

        return None

    # Resolves the property owner's phone number.
    def get_owner_phone(self, obj):
        property_obj = obj.reported_property

        if not property_obj:
            return None

        if property_obj.owner:
            return property_obj.owner_phone

        if property_obj.external_landlord:
            return property_obj.external_landlord.phone

        return None

    # Resolves the property owner's email address.
    def get_owner_email(self, obj):
        property_obj = obj.reported_property

        if not property_obj:
            return None

        if property_obj.owner:
            return property_obj.owner_email

        if property_obj.external_landlord:
            return property_obj.external_landlord.email

        return None

    # -------------------------------------------------------------- #
    # Admin report update handling                                   #
    # -------------------------------------------------------------- #

    def update(self, instance, validated_data):
        """
        Keeps resolved_at synchronized with an explicit admin
        report-status change.

        resolved/dismissed -> set resolved_at
        pending/reviewing  -> clear resolved_at
        """

        status_was_supplied = "status" in validated_data
        previous_status = instance.status

        report = super().update(
            instance,
            validated_data,
        )

        if not status_was_supplied:
            return report

        # Closed reports receive a resolution timestamp.
        if report.status in [
            "resolved",
            "dismissed",
        ]:
            if (
                report.resolved_at is None
                or previous_status not in [
                    "resolved",
                    "dismissed",
                ]
            ):
                report.resolved_at = timezone.now()

                report.save(
                    update_fields=[
                        "resolved_at",
                        "updated_at",
                    ]
                )

        # Reopening a previously closed report clears the old timestamp.
        elif report.resolved_at is not None:
            report.resolved_at = None

            report.save(
                update_fields=[
                    "resolved_at",
                    "updated_at",
                ]
            )

        return report