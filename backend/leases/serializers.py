from rest_framework import serializers
from .models import TenantLease
from properties.models import Room


class TenantLeaseSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="property.property_name", read_only=True)
    property_city = serializers.CharField(source="property.city", read_only=True)
    property_region = serializers.CharField(source="property.region", read_only=True)
    property_type = serializers.CharField(source="property.property_type", read_only=True)
    property_category = serializers.CharField(source="property.category", read_only=True)
    property_images = serializers.SerializerMethodField()

    tenant_name = serializers.SerializerMethodField()
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)
    tenant_phone = serializers.CharField(source="tenant.phone", read_only=True)

    landlord_name = serializers.SerializerMethodField()
    landlord_email = serializers.EmailField(source="landlord.email", read_only=True)
    landlord_phone = serializers.CharField(source="landlord.phone", read_only=True)

    room = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.select_related("property").all(),
        required=False,
        allow_null=True,
    )
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    room_type = serializers.CharField(source="room.room_type", read_only=True)
    room_gender_restriction = serializers.CharField(source="room.gender_restriction", read_only=True)
    room_max_capacity = serializers.IntegerField(source="room.max_capacity", read_only=True)
    room_occupied_spaces = serializers.IntegerField(source="room.occupied_spaces", read_only=True)
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
            "room_available_spaces",
            "lease_start_date",
            "lease_end_date",
            "move_in_date",
            "monthly_rent",
            "deposit_amount",
            "first_payment_status",
            "notes",
            "status",
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
            "property_images",
            "room_number",
            "room_type",
            "room_gender_restriction",
            "room_max_capacity",
            "room_occupied_spaces",
            "room_available_spaces",
            "status",
            "created_at",
        ]

    def get_property_images(self, obj):
        request = self.context.get("request")
        result = []

        for img in obj.property.images.all():
            if img.image:
                url = request.build_absolute_uri(img.image.url) if request else img.image.url
                result.append(url)

        return result

    def get_tenant_name(self, obj):
        if not obj.tenant:
            return "Unknown"
        full = f"{obj.tenant.first_name} {obj.tenant.last_name}".strip()
        return full or obj.tenant.username

    def get_landlord_name(self, obj):
        if not obj.landlord:
            return "Unknown"
        full = f"{obj.landlord.first_name} {obj.landlord.last_name}".strip()
        return full or obj.landlord.username

    def get_room_available_spaces(self, obj):
        if not obj.room:
            return None
        return obj.room.available_spaces()

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        property_obj = attrs.get("property") or getattr(instance, "property", None)
        room_obj = attrs.get("room") if "room" in attrs else getattr(instance, "room", None)

        if not property_obj:
            raise serializers.ValidationError({"property": "Property is required."})

        if property_obj.category == "hostel":
            if not room_obj:
                raise serializers.ValidationError({"room": "A room is required for hostel leases."})

            if room_obj.property_id != property_obj.id:
                raise serializers.ValidationError(
                    {"room": "Selected room does not belong to the selected hostel property."}
                )

            if room_obj.available_spaces() <= 0:
                raise serializers.ValidationError(
                    {"room": "This room is already full and cannot accept another tenant."}
                )

        elif property_obj.category == "house_rent":
            if room_obj:
                raise serializers.ValidationError(
                    {"room": "House rentals should not have a room selected."}
                )

            if not property_obj.is_available and instance is None:
                raise serializers.ValidationError(
                    {"property": "This property is no longer available."}
                )

        lease_start_date = attrs.get("lease_start_date") or getattr(instance, "lease_start_date", None)
        lease_end_date = attrs.get("lease_end_date") or getattr(instance, "lease_end_date", None)
        move_in_date = attrs.get("move_in_date") or getattr(instance, "move_in_date", None)

        if lease_start_date and lease_end_date and lease_end_date < lease_start_date:
            raise serializers.ValidationError(
                {"lease_end_date": "Lease end date cannot be earlier than lease start date."}
            )

        if lease_start_date and move_in_date and move_in_date < lease_start_date:
            raise serializers.ValidationError(
                {"move_in_date": "Move-in date cannot be earlier than lease start date."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        property_obj = validated_data["property"]
        room_obj = validated_data.get("room")

        validated_data["tenant"] = user
        validated_data["landlord"] = property_obj.owner

        if not validated_data.get("monthly_rent"):
            if property_obj.category == "hostel" and room_obj and room_obj.price_override is not None:
                validated_data["monthly_rent"] = room_obj.price_override
            else:
                validated_data["monthly_rent"] = property_obj.price

        lease = TenantLease.objects.create(**validated_data)
        return lease