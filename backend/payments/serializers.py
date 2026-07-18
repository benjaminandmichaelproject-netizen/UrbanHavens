from rest_framework import serializers

from bookings.models import Booking
from properties.models import Room

from .models import (
    OwnerPaymentAccount,
    Payment,
)


class OwnerPaymentAccountSerializer(serializers.ModelSerializer):
    # Returns a protected version of the owner's phone number.
    masked_phone_number = serializers.SerializerMethodField()

    class Meta:
        model = OwnerPaymentAccount

        fields = (
            "id",
            "account_name",
            "phone_number",
            "masked_phone_number",
            "provider",
            "is_verified",
            "is_active",
            "created_at",
            "updated_at",
        )

        read_only_fields = (
            "id",
            "masked_phone_number",
            "is_verified",
            "is_active",
            "created_at",
            "updated_at",
        )

        # Prevents the full phone number from being returned by the API.
        extra_kwargs = {
            "phone_number": {
                "write_only": True,
            }
        }

    # Returns only the final four digits of the phone number.
    def get_masked_phone_number(self, obj):
        return (
            f"****{obj.last_four_digits}"
            if obj.last_four_digits
            else ""
        )


class InitializePaymentSerializer(serializers.Serializer):
    # Identifies the booking the tenant wants to pay for.
    booking_id = serializers.IntegerField(
        min_value=1,
    )

    # Stores the approved rental duration selected by the tenant.
    duration_months = serializers.IntegerField(
        min_value=6,
    )

    # Identifies the selected hostel room when required.
    room_id = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )

    # Restricts payments to supported payment methods.
    payment_method = serializers.ChoiceField(
        choices=[
            "paystack",
            "direct",
        ],
    )

    # Validates booking ownership and secure room selection.
    def validate(self, attrs):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Authentication is required to initialize "
                        "a payment."
                    )
                }
            )

        booking_id = attrs["booking_id"]
        room_id = attrs.get("room_id")

        try:
            # Loads only a booking belonging to the authenticated tenant.
            booking = Booking.objects.select_related(
                "property",
                "tenant",
                "owner",
            ).get(
                id=booking_id,
                tenant=request.user,
            )
        except Booking.DoesNotExist:
            raise serializers.ValidationError(
                {
                    "booking_id": (
                        "Booking not found or does not belong to you."
                    )
                }
            )

        property_obj = booking.property

        if property_obj.category == "hostel":
            if not room_id:
                raise serializers.ValidationError(
                    {
                        "room_id": (
                            "Select a room before continuing with "
                            "hostel payment."
                        )
                    }
                )

            try:
                # Ensures the room belongs to the booking's hostel.
                room = Room.objects.get(
                    id=room_id,
                    property=property_obj,
                )
            except Room.DoesNotExist:
                raise serializers.ValidationError(
                    {
                        "room_id": (
                            "The selected room does not belong to "
                            "this hostel."
                        )
                    }
                )

            # Prevents payment for a full or fully reserved room.
            if (
                not room.is_available
                or room.available_spaces() <= 0
            ):
                raise serializers.ValidationError(
                    {
                        "room_id": (
                            "The selected room has no available space."
                        )
                    }
                )

            # Makes the verified room available to the payment view.
            attrs["_resolved_room"] = room

        elif room_id is not None:
            # Prevents attaching hostel rooms to house payments.
            raise serializers.ValidationError(
                {
                    "room_id": (
                        "Room selection is only allowed for hostel "
                        "payments."
                    )
                }
            )

        # Makes the verified booking available to the payment view.
        attrs["_resolved_booking"] = booking

        return attrs


class ConfirmDirectPaymentSerializer(serializers.Serializer):
    # Stores the actual amount confirmed by the owner.
    amount_received = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0.01,
    )

    # Stores an optional note about the direct payment.
    confirmation_note = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=1000,
    )


class PaymentSerializer(serializers.ModelSerializer):
    # Returns readable tenant and landlord names.
    tenant_name = serializers.SerializerMethodField()
    landlord_name = serializers.SerializerMethodField()

    # Returns the property name without allowing modification.
    property_name = serializers.CharField(
        source="property.property_name",
        read_only=True,
    )

    # Returns the property category for house or hostel display.
    property_category = serializers.CharField(
        source="property.category",
        read_only=True,
    )

    # Returns selected hostel room details when applicable.
    room_number = serializers.CharField(
        source="room.room_number",
        read_only=True,
        allow_null=True,
    )
    room_type = serializers.CharField(
        source="room.room_type",
        read_only=True,
        allow_null=True,
    )

    # Returns the readable receipt payment status.
    payment_completion_status_display = (
        serializers.CharField(
            source="get_payment_completion_status_display",
            read_only=True,
        )
    )

    class Meta:
        model = Payment

        fields = (
            "id",
            "tenant",
            "tenant_name",
            "landlord",
            "landlord_name",
            "booking",
            "property",
            "property_name",
            "property_category",
            "room",
            "room_number",
            "room_type",
            "payment_type",
            "payment_method",
            "duration_months",
            "amount",
            "expected_amount",
            "amount_received",
            "payment_completion_status",
            "payment_completion_status_display",
            "outstanding_balance",
            "receipt_number",
            "receipt_generated_at",
            "platform_commission",
            "paystack_fee",
            "owner_net_amount",
            "reference",
            "status",
            "settlement_status",
            "settlement_reference",
            "settlement_id",
            "settlement_account",
            "settled_at",
            "paystack_authorization_url",
            "verified_at",
            "created_at",
        )

        # Prevents clients from modifying payment or receipt records.
        read_only_fields = fields

    # Returns the tenant's safest available readable name.
    def get_tenant_name(self, obj):
        tenant = obj.tenant

        full_name = (
            f"{tenant.first_name} "
            f"{tenant.last_name}"
        ).strip()

        return (
            full_name
            or tenant.username
            or tenant.email
        )

    # Returns the landlord's safest available readable name.
    def get_landlord_name(self, obj):
        landlord = obj.landlord

        full_name = (
            f"{landlord.first_name} "
            f"{landlord.last_name}"
        ).strip()

        return (
            full_name
            or landlord.username
            or landlord.email
        )