from rest_framework import serializers

from properties.models import Room

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
            "property_allowed_rental_months",
            "property_images",
            "room_number",
            "room_type",
            "room_gender_restriction",
            "room_max_capacity",
            "room_occupied_spaces",
            "room_reserved_spaces",
            "room_available_spaces",
            "status",
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

    # Validates property, room, and lease date relationships.
    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        property_obj = (
            attrs.get("property")
            or getattr(instance, "property", None)
        )

        room_obj = (
            attrs.get("room")
            if "room" in attrs
            else getattr(instance, "room", None)
        )

        if not property_obj:
            raise serializers.ValidationError(
                {
                    "property": "Property is required.",
                }
            )

        if property_obj.category == "hostel":
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

            # Allows a reserved room to be converted into a lease.
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

        elif property_obj.category == "house_rent":
            if room_obj:
                raise serializers.ValidationError(
                    {
                        "room": (
                            "House rentals should not have a room "
                            "selected."
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
                        "lease start date."
                    )
                }
            )

        return attrs

    # Creates a lease using the room or property rental price.
    def create(self, validated_data):
        property_obj = validated_data["property"]
        room_obj = validated_data.get("room")

        if not validated_data.get("monthly_rent"):
            if (
                property_obj.category == "hostel"
                and room_obj
                and room_obj.price_override is not None
            ):
                validated_data["monthly_rent"] = (
                    room_obj.price_override
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
        min_value=0,
        required=False,
        default=0,
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