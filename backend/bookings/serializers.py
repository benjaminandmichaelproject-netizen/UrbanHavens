from rest_framework import serializers
from .models import Booking
from notifications.utils import send_notification


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

    def validate_property(self, property_obj):
        if not property_obj.is_available:
            raise serializers.ValidationError("This property is not available for booking.")

        if property_obj.approval_status != "approved":
            raise serializers.ValidationError("Only approved properties can be booked.")

        if property_obj.owner is None:
            raise serializers.ValidationError(
                "This property cannot be booked because the owner does not have a registered account yet."
            )

        return property_obj

    def create(self, validated_data):
        request = self.context.get("request")
        property_obj = validated_data["property"]

        booking = Booking.objects.create(
            tenant=request.user,
            owner=property_obj.owner,
            **validated_data
        )

        send_notification(
            user=property_obj.owner,
            message=f"{booking.name} submitted a booking request for inspection of {property_obj.property_name}.",
            notification_type="inspection_request",
            property_id=property_obj.id,
        )

        return booking