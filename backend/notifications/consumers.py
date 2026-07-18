import json

from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")

        if not user or not getattr(user, "is_authenticated", False):
            await self.close(code=4001)
            return

        self.user = user
        self.group_name = f"user_{self.user.id}"

        try:
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name,
            )
            await self.accept()
        except Exception:
            await self.close(code=4500)

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(
                    self.group_name,
                    self.channel_name,
                )
            except Exception:
                pass

    async def send_notification(self, event):
        """Handles type: 'send.notification' — general notifications."""
        data = event.get("data", {})
        await self.send(text_data=json.dumps(data))

    async def support_event(self, event):
        """
        Handles type: 'support.event' — forwarded to the owner's browser
        so the dashboard updates in real time without a page refresh.

        Called when the backend does:
            channel_layer.group_send(f"user_{owner_id}", {
                "type": "support.event",
                "event": "support_invite_accepted",  # or any support_* string
                ...payload...
            })
        """
        # Strip the internal 'type' key — the client doesn't need it
        payload = {k: v for k, v in event.items() if k != "type"}
        await self.send(text_data=json.dumps(payload))