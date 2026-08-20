from decimal import Decimal

from rest_framework import serializers

from bookings.models import Booking
from properties.models import ApartmentUnit, Room

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

    # Identifies the selected unit for a multi-unit apartment.
    apartment_unit_id = serializers.IntegerField(
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

    # Validates booking ownership and the selected rentable resource.
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
        apartment_unit_id = attrs.get("apartment_unit_id")

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
            # Hostel payments must select a room only.
            if room_id is None:
                raise serializers.ValidationError(
                    {
                        "room_id": (
                            "Select a room before continuing with "
                            "hostel payment."
                        )
                    }
                )

            if apartment_unit_id is not None:
                raise serializers.ValidationError(
                    {
                        "apartment_unit_id": (
                            "Apartment-unit selection is not allowed "
                            "for hostel payments."
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

        elif (
            property_obj.category == "apartment"
            and property_obj.apartment_listing_type == "multi_unit"
        ):
            # Multi-unit apartment payments must select one exact unit.
            if apartment_unit_id is None:
                raise serializers.ValidationError(
                    {
                        "apartment_unit_id": (
                            "Select an apartment unit before continuing "
                            "with payment."
                        )
                    }
                )

            if room_id is not None:
                raise serializers.ValidationError(
                    {
                        "room_id": (
                            "Hostel-room selection is not allowed for "
                            "apartment payments."
                        )
                    }
                )

            try:
                # Ensures the unit belongs to the booking's apartment.
                apartment_unit = ApartmentUnit.objects.get(
                    id=apartment_unit_id,
                    property=property_obj,
                )
            except ApartmentUnit.DoesNotExist:
                raise serializers.ValidationError(
                    {
                        "apartment_unit_id": (
                            "The selected apartment unit does not belong "
                            "to this property."
                        )
                    }
                )

            # Only currently available apartment units can enter payment.
            if apartment_unit.status != "available":
                raise serializers.ValidationError(
                    {
                        "apartment_unit_id": (
                            "The selected apartment unit is no longer "
                            "available."
                        )
                    }
                )

            # Makes the verified unit available to the payment view.
            attrs["_resolved_apartment_unit"] = apartment_unit

        else:
            # Houses and single apartments use the parent Property directly.
            if room_id is not None:
                raise serializers.ValidationError(
                    {
                        "room_id": (
                            "Room selection is only allowed for hostel "
                            "payments."
                        )
                    }
                )

            if apartment_unit_id is not None:
                raise serializers.ValidationError(
                    {
                        "apartment_unit_id": (
                            "Apartment-unit selection is only allowed "
                            "for multi-unit apartment payments."
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
        min_value=Decimal("0.01"),
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

    # Returns the property category for rental-type display.
    property_category = serializers.CharField(
        source="property.category",
        read_only=True,
    )

    # Returns the apartment listing type when the property is an apartment.
    apartment_listing_type = serializers.CharField(
        source="property.apartment_listing_type",
        read_only=True,
        allow_null=True,
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

    # Returns selected apartment-unit details when applicable.
    apartment_unit_number = serializers.CharField(
        source="apartment_unit.unit_number",
        read_only=True,
        allow_null=True,
    )
    apartment_unit_floor = serializers.CharField(
        source="apartment_unit.floor",
        read_only=True,
        allow_null=True,
    )
    apartment_unit_bedrooms = serializers.IntegerField(
        source="apartment_unit.bedrooms",
        read_only=True,
        allow_null=True,
    )
    apartment_unit_bathrooms = serializers.IntegerField(
        source="apartment_unit.bathrooms",
        read_only=True,
        allow_null=True,
    )
    apartment_unit_price = serializers.DecimalField(
        source="apartment_unit.price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    apartment_unit_status = serializers.CharField(
        source="apartment_unit.status",
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
            "apartment_listing_type",
            "room",
            "room_number",
            "room_type",
            "apartment_unit",
            "apartment_unit_number",
            "apartment_unit_floor",
            "apartment_unit_bedrooms",
            "apartment_unit_bathrooms",
            "apartment_unit_price",
            "apartment_unit_status",
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