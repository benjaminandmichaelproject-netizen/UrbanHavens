from rest_framework import serializers
from .models import Booking
from notifications.models import Notification


class BookingSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="property.property_name", read_only=True)
    tenant_name = serializers.CharField(source="tenant.username", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "property",
            "property_name",
            "tenant",
            "tenant_name",
            "owner",
            "name",
            "email",
            "phone",
            "message",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "tenant",
            "tenant_name",
            "owner",
            "property_name",
            "status",
            "created_at",
        ]

    def create(self, validated_data):
        request = self.context.get("request")
        property_obj = validated_data["property"]

        booking = Booking.objects.create(
            tenant=request.user,
            owner=property_obj.owner,
            **validated_data
        )

        Notification.objects.create(
            recipient=property_obj.owner,
            sender=request.user,
            title="New Booking Request",
            message=f"{booking.name} submitted a booking request for inspection of {property_obj.property_name}.",
            notification_type="booking",
            link="/dashboard/owner/bookings",
        )

        return booking