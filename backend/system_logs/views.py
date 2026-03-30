from django.shortcuts import render

# Create your views here.
from rest_framework import serializers, viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import SystemLog


class SystemLogSerializer(serializers.ModelSerializer):
    """Serialise a SystemLog row for the dashboard API."""

    # Flatten the user FK to just a display string
    user_display = serializers.SerializerMethodField()

    class Meta:
        model  = SystemLog
        fields = [
            "id",
            "category",
            "status",
            "message",
            "detail",
            "phone",
            "endpoint",
            "status_code",
            "booking_id",
            "meeting_id",
            "user_display",
            "created_at",
        ]

    def get_user_display(self, obj):
        if obj.user:
            return f"{obj.user.username} ({obj.user.role})"
        return None


class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API for SystemLog records.

    Restricted to admin users and superusers only.

    Query parameters:
        - category   : filter by category (sms, api_error, booking, etc.)
        - status     : filter by status (success, failure, info)
        - limit      : number of records to return (default 100, max 500)
    """

    serializer_class   = SystemLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Only admins and superusers can access system logs
        if not (user.is_superuser or getattr(user, "role", None) == "admin"):
            return SystemLog.objects.none()

        queryset = SystemLog.objects.select_related("user").order_by("-created_at")

        # Optional filters from query params
        category = self.request.query_params.get("category")
        status   = self.request.query_params.get("status")
        limit    = min(int(self.request.query_params.get("limit", 100)), 500)

        if category:
            queryset = queryset.filter(category=category)
        if status:
            queryset = queryset.filter(status=status)

        return queryset[:limit]

    @action(detail=False, methods=["delete"], url_path="clear")
    def clear(self, request):
        """
        Delete all log records. Admin only.
        Useful for resetting the dashboard during development.
        """
        user = request.user
        if not (user.is_superuser or getattr(user, "role", None) == "admin"):
            return Response({"detail": "Not authorised."}, status=403)

        count, _ = SystemLog.objects.all().delete()
        return Response({"detail": f"{count} log records deleted."})