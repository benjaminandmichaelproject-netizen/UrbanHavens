from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "recipient",
            "message",
            "notification_type",
            "is_read",
            "related_property_id",
            "created_at",
        ]
        read_only_fields = fields