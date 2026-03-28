from rest_framework import serializers
from .models import AdminSupportSession


class AdminSupportSessionSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.username", read_only=True)
    owner_email = serializers.CharField(source="owner.email", read_only=True)
    admin_name = serializers.CharField(source="admin.username", read_only=True)
    admin_email = serializers.CharField(source="admin.email", read_only=True)
    time_left_seconds = serializers.SerializerMethodField()

    class Meta:
        model = AdminSupportSession
        fields = [
            "id",
            "owner",
            "owner_name",
            "owner_email",
            "admin",
            "admin_name",
            "admin_email",
            "reason",
            "status",
            "duration_minutes",
            "invited_at",
            "started_at",
            "expires_at",
            "ended_at",
            "time_left_seconds",
        ]
        read_only_fields = [
            "id",
            "status",
            "invited_at",
            "started_at",
            "expires_at",
            "ended_at",
            "owner_name",
            "owner_email",
            "admin_name",
            "admin_email",
            "time_left_seconds",
        ]

    def get_time_left_seconds(self, obj):
        if obj.status != AdminSupportSession.STATUS_ACTIVE or not obj.expires_at:
            return 0

        diff = (obj.expires_at - __import__("django.utils.timezone").utils.timezone.now()).total_seconds()
        return max(0, int(diff))


class CreateAdminSupportSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminSupportSession
        fields = ["admin", "reason"]

    def validate_admin(self, value):
        if value.role != "admin":
            raise serializers.ValidationError("Selected user is not an admin.")
        if not value.is_active:
            raise serializers.ValidationError("Selected admin is not active.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        owner = request.user

        active_existing = AdminSupportSession.objects.filter(
            owner=owner,
            status__in=[
                AdminSupportSession.STATUS_PENDING,
                AdminSupportSession.STATUS_ACTIVE,
            ],
        ).exists()

        if active_existing:
            raise serializers.ValidationError(
                {"detail": "You already have a pending or active admin support session."}
            )

        return AdminSupportSession.objects.create(
            owner=owner,
            created_by=owner,
            **validated_data,
        )