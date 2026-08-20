from decimal import Decimal

from rest_framework import serializers

from payments.models import Payment
from properties.models import ApartmentUnit, Room

from .models import TenantLease


class TenantLeaseSerializer(serializers.ModelSerializer):
    # Returns readable property information with the lease.
    property_name = serializers.CharField(
        source="property.property_name",
        read_only=True,
    )
    property_city = serializers.CharField(
        source="property.city",
        read_only=True,
    )
    property_region = serializers.CharField(
        source="property.region",
        read_only=True,
    )
    property_type = serializers.CharField(
        source="property.property_type",
        read_only=True,
    )
    property_category = serializers.CharField(
        source="property.category",
        read_only=True,
    )
    apartment_listing_type = serializers.CharField(
        source="property.apartment_listing_type",
        read_only=True,
        allow_null=True,
    )
    property_allowed_rental_months = serializers.JSONField(
        source="property.allowed_rental_months",
        read_only=True,
    )
    property_images = serializers.SerializerMethodField()

    # Returns readable tenant information with the lease.
    tenant_name = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(
        source="tenant.email",
        read_only=True,
    )
    tenant_phone = serializers.CharField(
        source="tenant.phone",
        read_only=True,
    )

    # Returns readable landlord information with the lease.
    landlord_name = serializers.SerializerMethodField()
    landlord_email = serializers.EmailField(
        source="landlord.email",
        read_only=True,
    )
    landlord_phone = serializers.CharField(
        source="landlord.phone",
        read_only=True,
    )

    # Allows room assignment only for valid hostel leases.
    room = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.select_related("property").all(),
        required=False,
        allow_null=True,
    )

    # Returns readable hostel room information.
    room_number = serializers.CharField(
        source="room.room_number",
        read_only=True,
    )
    room_type = serializers.CharField(
        source="room.room_type",
        read_only=True,
    )
    room_gender_restriction = serializers.CharField(
        source="room.gender_restriction",
        read_only=True,
    )
    room_max_capacity = serializers.IntegerField(
        source="room.max_capacity",
        read_only=True,
    )
    room_occupied_spaces = serializers.IntegerField(
        source="room.occupied_spaces",
        read_only=True,
    )
    room_reserved_spaces = serializers.IntegerField(
        source="room.reserved_spaces",
        read_only=True,
    )
    room_available_spaces = serializers.SerializerMethodField()

    # Allows apartment-unit assignment only for multi-unit apartments.
    apartment_unit = serializers.PrimaryKeyRelatedField(
        queryset=ApartmentUnit.objects.select_related("property").all(),
        required=False,
        allow_null=True,
    )

    # Returns readable apartment-unit information.
    apartment_unit_number = serializers.CharField(
        source="apartment_unit.unit_number",
        read_only=True,
    )
    apartment_unit_floor = serializers.CharField(
        source="apartment_unit.floor",
        read_only=True,
        allow_null=True,
    )
    apartment_unit_bedrooms = serializers.IntegerField(
        source="apartment_unit.bedrooms",
        read_only=True,
    )
    apartment_unit_bathrooms = serializers.IntegerField(
        source="apartment_unit.bathrooms",
        read_only=True,
    )
    apartment_unit_price = serializers.DecimalField(
        source="apartment_unit.price",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    apartment_unit_status = serializers.CharField(
        source="apartment_unit.status",
        read_only=True,
    )
    apartment_unit_is_furnished = serializers.BooleanField(
        source="apartment_unit.is_furnished",
        read_only=True,
    )
    apartment_unit_amenities = serializers.JSONField(
        source="apartment_unit.amenities",
        read_only=True,
    )

    # Allows booking-backed leases to derive rent securely from payment.
    monthly_rent = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
    )

    class Meta:
        model = TenantLease

        fields = [
            "id",
            "booking",
            "property",
            "property_name",
            "property_city",
            "property_region",
            "property_type",
            "property_category",
            "apartment_listing_type",
            "property_images",
            "property_allowed_rental_months",
            "tenant",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "landlord",
            "landlord_name",
            "landlord_email",
            "landlord_phone",
            "room",
            "room_number",
            "room_type",
            "room_gender_restriction",
            "room_max_capacity",
            "room_occupied_spaces",
            "room_reserved_spaces",
            "room_available_spaces",
            "apartment_unit",
            "apartment_unit_number",
            "apartment_unit_floor",
            "apartment_unit_bedrooms",
            "apartment_unit_bathrooms",
            "apartment_unit_price",
            "apartment_unit_status",
            "apartment_unit_is_furnished",
            "apartment_unit_amenities",
            "lease_start_date",
            "lease_end_date",
            "move_in_date",
            "monthly_rent",
            "deposit_amount",
            "first_payment_status",
            "notes",
            "status",
            "agreement_number",
            "agreement_generated_at",
            "created_at",
        ]

        read_only_fields = [
            "tenant",
            "landlord",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "landlord_name",
            "landlord_email",
            "landlord_phone",
            "property_name",
            "property_city",
            "property_region",
            "property_type",
            "property_category",
            "apartment_listing_type",
            "property_allowed_rental_months",
            "property_images",
            "room_number",
            "room_type",
            "room_gender_restriction",
            "room_max_capacity",
            "room_occupied_spaces",
            "room_reserved_spaces",
            "room_available_spaces",
            "apartment_unit_number",
            "apartment_unit_floor",
            "apartment_unit_bedrooms",
            "apartment_unit_bathrooms",
            "apartment_unit_price",
            "apartment_unit_status",
            "apartment_unit_is_furnished",
            "apartment_unit_amenities",
            "status",
            "agreement_number",
            "agreement_generated_at",
            "created_at",
        ]

    # Returns absolute property image URLs when a request is available.
    def get_property_images(self, obj):
        request = self.context.get("request")
        result = []

        for image_obj in obj.property.images.all():
            if not image_obj.image:
                continue

            image_url = image_obj.image.url

            if request:
                image_url = request.build_absolute_uri(image_url)

            result.append(image_url)

        return result

    # Returns the tenant's safest readable name.
    def get_tenant_name(self, obj):
        if not obj.tenant:
            return "Unknown"

        full_name = (
            f"{obj.tenant.first_name} "
            f"{obj.tenant.last_name}"
        ).strip()

        return (
            full_name
            or obj.tenant.username
            or obj.tenant.email
        )

    # Returns the landlord's safest readable name.
    def get_landlord_name(self, obj):
        if not obj.landlord:
            return "Unknown"

        full_name = (
            f"{obj.landlord.first_name} "
            f"{obj.landlord.last_name}"
        ).strip()

        return (
            full_name
            or obj.landlord.username
            or obj.landlord.email
        )

    # Returns the room's remaining unoccupied and unreserved spaces.
    def get_room_available_spaces(self, obj):
        if not obj.room:
            return None

        return obj.room.available_spaces()

    # Resolves the successful payment for a new booking-backed lease.
    def _resolve_booking_payment(self, booking_obj):
        if not booking_obj:
            return None

        payment = (
            Payment.objects.select_related(
                "property",
                "room",
                "apartment_unit",
            )
            .filter(
                booking=booking_obj,
                status="success",
            )
            .first()
        )

        if not payment:
            raise serializers.ValidationError(
                {
                    "booking": (
                        "A successful payment is required before "
                        "creating this lease."
                    )
                }
            )

        return payment

    # Validates property, rentable resource, payment, and lease dates.
    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        property_obj = (
            attrs.get("property")
            or getattr(instance, "property", None)
        )

        booking_obj = (
            attrs.get("booking")
            if "booking" in attrs
            else getattr(instance, "booking", None)
        )

        room_obj = (
            attrs.get("room")
            if "room" in attrs
            else getattr(instance, "room", None)
        )

        apartment_unit_obj = (
            attrs.get("apartment_unit")
            if "apartment_unit" in attrs
            else getattr(instance, "apartment_unit", None)
        )

        if not property_obj:
            raise serializers.ValidationError(
                {
                    "property": "Property is required.",
                }
            )

        # For a new booking-backed lease, the successful Payment is the
        # authority for the exact room or apartment unit that was paid for.
        payment = None

        if instance is None and booking_obj:
            payment = self._resolve_booking_payment(booking_obj)

            if payment.property_id != property_obj.id:
                raise serializers.ValidationError(
                    {
                        "property": (
                            "Selected property does not match the "
                            "successful payment property."
                        )
                    }
                )

            if room_obj and payment.room_id != room_obj.id:
                raise serializers.ValidationError(
                    {
                        "room": (
                            "Selected room does not match the room "
                            "attached to the successful payment."
                        )
                    }
                )

            if (
                apartment_unit_obj
                and payment.apartment_unit_id != apartment_unit_obj.id
            ):
                raise serializers.ValidationError(
                    {
                        "apartment_unit": (
                            "Selected apartment unit does not match "
                            "the unit attached to the successful payment."
                        )
                    }
                )

            room_obj = payment.room
            apartment_unit_obj = payment.apartment_unit

            attrs["room"] = room_obj
            attrs["apartment_unit"] = apartment_unit_obj

            # Uses the exact monthly rent represented by the completed
            # payment instead of trusting a client-submitted rent value.
            if payment.duration_months:
                attrs["monthly_rent"] = (
                    payment.amount
                    / Decimal(str(payment.duration_months))
                ).quantize(Decimal("0.01"))

        if property_obj.category == "hostel":
            if apartment_unit_obj:
                raise serializers.ValidationError(
                    {
                        "apartment_unit": (
                            "An apartment unit cannot be selected "
                            "for a hostel lease."
                        )
                    }
                )

            if not room_obj:
                raise serializers.ValidationError(
                    {
                        "room": (
                            "A room is required for hostel leases."
                        )
                    }
                )

            if room_obj.property_id != property_obj.id:
                raise serializers.ValidationError(
                    {
                        "room": (
                            "Selected room does not belong to the "
                            "selected hostel property."
                        )
                    }
                )

            # A completed payment should have reserved one room space.
            # Manual renewal can still use a currently available space.
            if instance is None and room_obj.reserved_spaces <= 0:
                if room_obj.available_spaces() <= 0:
                    raise serializers.ValidationError(
                        {
                            "room": (
                                "This room has no reserved or "
                                "available space."
                            )
                        }
                    )

        elif (
            property_obj.category == "apartment"
            and property_obj.apartment_listing_type == "multi_unit"
        ):
            if room_obj:
                raise serializers.ValidationError(
                    {
                        "room": (
                            "A hostel room cannot be selected for "
                            "an apartment lease."
                        )
                    }
                )

            if not apartment_unit_obj:
                raise serializers.ValidationError(
                    {
                        "apartment_unit": (
                            "An apartment unit is required for "
                            "multi-unit apartment leases."
                        )
                    }
                )

            if apartment_unit_obj.property_id != property_obj.id:
                raise serializers.ValidationError(
                    {
                        "apartment_unit": (
                            "Selected apartment unit does not belong "
                            "to this apartment property."
                        )
                    }
                )

            # Payment-backed creation expects a reserved unit. Manual
            # renewal may legitimately start from an available unit.
            if (
                instance is None
                and apartment_unit_obj.status
                not in ["reserved", "available"]
            ):
                raise serializers.ValidationError(
                    {
                        "apartment_unit": (
                            "This apartment unit is not available "
                            "for lease activation."
                        )
                    }
                )

        else:
            # Houses and single apartments use the parent Property only.
            if room_obj:
                raise serializers.ValidationError(
                    {
                        "room": (
                            "A room can only be selected for "
                            "hostel leases."
                        )
                    }
                )

            if apartment_unit_obj:
                raise serializers.ValidationError(
                    {
                        "apartment_unit": (
                            "An apartment unit can only be selected "
                            "for multi-unit apartment leases."
                        )
                    }
                )

        lease_start_date = (
            attrs.get("lease_start_date")
            or getattr(instance, "lease_start_date", None)
        )
        lease_end_date = (
            attrs.get("lease_end_date")
            or getattr(instance, "lease_end_date", None)
        )
        move_in_date = (
            attrs.get("move_in_date")
            or getattr(instance, "move_in_date", None)
        )

        if (
            lease_start_date
            and lease_end_date
            and lease_end_date < lease_start_date
        ):
            raise serializers.ValidationError(
                {
                    "lease_end_date": (
                        "Lease end date cannot be earlier than "
                        "lease start date."
                    )
                }
            )

        if (
            lease_start_date
            and move_in_date
            and move_in_date < lease_start_date
        ):
            raise serializers.ValidationError(
                {
                    "move_in_date": (
                        "Move-in date cannot be earlier than "
                        "the lease start date."
                    )
                }
            )

        return attrs

    # Creates a lease using the trusted room, apartment-unit, or property rent.
    def create(self, validated_data):
        property_obj = validated_data["property"]
        room_obj = validated_data.get("room")
        apartment_unit_obj = validated_data.get("apartment_unit")

        if validated_data.get("monthly_rent") is None:
            if (
                property_obj.category == "hostel"
                and room_obj
                and room_obj.price_override is not None
            ):
                validated_data["monthly_rent"] = (
                    room_obj.price_override
                )
            elif (
                property_obj.category == "apartment"
                and property_obj.apartment_listing_type == "multi_unit"
                and apartment_unit_obj
            ):
                validated_data["monthly_rent"] = (
                    apartment_unit_obj.price
                )
            else:
                validated_data["monthly_rent"] = (
                    property_obj.price
                )

        return TenantLease.objects.create(**validated_data)


class CreateLeaseFromPaymentSerializer(serializers.Serializer):
    # Stores the date on which the lease legally begins.
    lease_start_date = serializers.DateField()

    # Stores the tenant's agreed move-in date.
    move_in_date = serializers.DateField()

    # Stores any deposit amount confirmed during lease preparation.
    deposit_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
        default=Decimal("0.00"),
    )

    # Stores optional lease preparation notes from the landlord.
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=2000,
    )

    # Validates the landlord-provided lease dates.
    def validate(self, attrs):
        lease_start_date = attrs["lease_start_date"]
        move_in_date = attrs["move_in_date"]

        if move_in_date < lease_start_date:
            raise serializers.ValidationError(
                {
                    "move_in_date": (
                        "Move-in date cannot be earlier than "
                        "the lease start date."
                    )
                }
            )

        return attrs