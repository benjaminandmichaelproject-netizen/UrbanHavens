from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Notification
from .serializers import NotificationSerializer


def send_notification(user, message, notification_type, property_id=None):
    # Save to DB
    notification = Notification.objects.create(
        recipient=user,
        message=message,
        notification_type=notification_type,
        related_property_id=property_id,
    )

    # Serialize
    serializer = NotificationSerializer(notification)

    # Send via WebSocket
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"user_{user.id}",
        {
            "type": "send_notification",
            "data": serializer.data,
        },
    )