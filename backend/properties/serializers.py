import json

from rest_framework import serializers

from .models import ExternalLandlord, Property, PropertyImage
from users.models import User


def _notify_admins(message, notification_type, property_id=None):
    """Send a notification to all admin users."""
    from notifications.utils import send_notification

    admins = User.objects.filter(role="admin", is_active=True)
    for admin in admins:
        send_notification(
            user=admin,
            message=message,
            notification_type=notification_type,
            property_id=property_id,
        )


class PropertyImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = PropertyImage
        fields = ["id", "image"]

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image:
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class ExternalLandlordSerializer(serializers.ModelSerializer):
    properties_count = serializers.SerializerMethodField()
    document_file = serializers.SerializerMethodField()

    class Meta:
        model = ExternalLandlord
        fields = [
            "id",
            "full_name",
            "phone",
            "email",
            "business_name",
            "document_type",
            "id_number",
            "document_file",
            "is_verified",
            "properties_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "is_verified",
            "properties_count",
            "created_at",
            "updated_at",
        ]

    def get_properties_count(self, obj):
        return obj.properties.count()

    def get_document_file(self, obj):
        request = self.context.get("request")
        if obj.document_file:
            return request.build_absolute_uri(obj.document_file.url) if request else obj.document_file.url
        return None


class RegisteredLandlordSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "is_verified",
        ]

    def get_name(self, obj):
        full_name = f"{obj.first_name} {obj.last_name}".strip()
        return full_name or obj.username

    def get_is_verified(self, obj):
        profile = getattr(obj, "landlord_profile", None)
        return profile.is_verified if profile else False


class FlexibleJSONField(serializers.Field):
    def to_internal_value(self, data):
        if data in [None, "", []]:
            return []

        if isinstance(data, (list, dict)):
            return data

        if isinstance(data, str):
            try:
                parsed = json.loads(data)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Invalid JSON string.")

            if not isinstance(parsed, (list, dict)):
                raise serializers.ValidationError("Must be a JSON array or object.")

            return parsed

        raise serializers.ValidationError("Unsupported type for JSON field.")

    def to_representation(self, value):
        if value in [None, ""]:
            return []

        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value

        return value


class PropertySerializer(serializers.ModelSerializer):
    images = PropertyImageSerializer(many=True, read_only=True)
    amenities = FlexibleJSONField(required=False)

    owner_reference_id = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_phone = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()
    owner_source = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    owner_user_id = serializers.IntegerField(write_only=True, required=False)
    external_landlord_id = serializers.IntegerField(write_only=True, required=False)

    external_full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    external_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    external_email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    external_business_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    external_document_type = serializers.CharField(write_only=True, required=False, allow_blank=True)
    external_id_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    external_document_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Property
        fields = [
            "id",
            "owner_reference_id",
            "owner_name",
            "owner_phone",
            "owner_email",
            "owner_source",
            "approved_by_name",
            "owner_user_id",
            "external_landlord_id",
            "external_full_name",
            "external_phone",
            "external_email",
            "external_business_name",
            "external_document_type",
            "external_id_number",
            "external_document_file",
            "property_name",
            "category",
            "property_type",
            "bedrooms",
            "bathrooms",
            "price",
            "description",
            "amenities",
            "region",
            "city",
            "school",
            "lat",
            "lng",
            "is_available",
            "approval_status",
            "is_featured",
            "approved_at",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "owner_reference_id",
            "owner_name",
            "owner_phone",
            "owner_email",
            "owner_source",
            "approved_by_name",
            "approval_status",
            "is_featured",
            "approved_at",
            "created_at",
            "updated_at",
        ]

    def get_owner_reference_id(self, obj):
        if obj.owner:
            return obj.owner.id
        if obj.external_landlord:
            return obj.external_landlord.id
        return None

    def get_owner_name(self, obj):
        return obj.owner_name

    def get_owner_phone(self, obj):
        return obj.owner_phone

    def get_owner_email(self, obj):
        return obj.owner_email

    def get_owner_source(self, obj):
        if obj.owner:
            return "registered"
        if obj.external_landlord:
            return "external"
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            full_name = f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
            return full_name or obj.approved_by.username
        return None

    def _has_new_external_data(self, attrs):
        external_full_name = attrs.get("external_full_name", "").strip()
        external_document_type = attrs.get("external_document_type", "").strip()
        external_id_number = attrs.get("external_id_number", "").strip()
        external_document_file = attrs.get("external_document_file")

        return bool(
            external_full_name or external_document_type or external_id_number or external_document_file
        )

    def _validate_registered_owner(self, owner_user_id):
        try:
            owner_user = User.objects.get(id=owner_user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                "owner_user_id": "Selected owner does not exist."
            })

        if getattr(owner_user, "role", None) != "owner" and not owner_user.is_superuser:
            raise serializers.ValidationError({
                "owner_user_id": "Selected user is not a registered owner."
            })

        return owner_user

    def _validate_existing_external_landlord(self, external_landlord_id):
        try:
            return ExternalLandlord.objects.get(id=external_landlord_id)
        except ExternalLandlord.DoesNotExist:
            raise serializers.ValidationError({
                "external_landlord_id": "Selected external landlord does not exist."
            })

    def _validate_new_external_landlord_data(self, attrs):
        external_full_name = attrs.get("external_full_name", "").strip()
        external_document_type = attrs.get("external_document_type", "").strip()
        external_id_number = attrs.get("external_id_number", "").strip()
        external_document_file = attrs.get("external_document_file")

        if not external_full_name:
            raise serializers.ValidationError({
                "external_full_name": "Full name is required."
            })
        if not external_document_type:
            raise serializers.ValidationError({
                "external_document_type": "Document type is required."
            })
        if not external_id_number:
            raise serializers.ValidationError({
                "external_id_number": "ID number is required."
            })
        if not external_document_file:
            raise serializers.ValidationError({
                "external_document_file": "Document file is required."
            })

        if ExternalLandlord.objects.filter(id_number=external_id_number).exists():
            raise serializers.ValidationError({
                "external_id_number": "This ID number is already registered. Use external_landlord_id instead."
            })

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None
        instance = getattr(self, "instance", None)

        owner_user_id = attrs.get("owner_user_id")
        external_landlord_id = attrs.get("external_landlord_id")
        creating_new_external = self._has_new_external_data(attrs)

        is_admin = bool(
            user and user.is_authenticated and (
                user.is_superuser or getattr(user, "role", None) == "admin"
            )
        )
        is_owner = bool(
            user and user.is_authenticated and getattr(user, "role", None) == "owner"
        )

        ownership_fields_present = any([
            owner_user_id is not None,
            external_landlord_id is not None,
            creating_new_external,
        ])

        # UPDATE RULES
        if instance is not None:
            if ownership_fields_present:
                raise serializers.ValidationError(
                    "Ownership cannot be changed through update. Use a dedicated transfer flow."
                )

            if not (is_admin or is_owner):
                raise serializers.ValidationError("You are not allowed to update this property.")

            return attrs

        # CREATE RULES
        if is_owner and not is_admin:
            if ownership_fields_present:
                raise serializers.ValidationError({
                    "detail": "Owners can only create properties for themselves."
                })
            return attrs

        if is_admin:
            selected_sources = sum([
                bool(owner_user_id),
                bool(external_landlord_id),
                bool(creating_new_external),
            ])

            if selected_sources != 1:
                raise serializers.ValidationError(
                    "Admin must choose exactly one owner source: "
                    "owner_user_id, external_landlord_id, or new external landlord details."
                )

            if owner_user_id:
                self._validate_registered_owner(owner_user_id)

            if external_landlord_id:
                self._validate_existing_external_landlord(external_landlord_id)

            if creating_new_external:
                self._validate_new_external_landlord_data(attrs)

            return attrs

        raise serializers.ValidationError("You are not allowed to create a property.")

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        owner_user_id = validated_data.pop("owner_user_id", None)
        external_landlord_id = validated_data.pop("external_landlord_id", None)

        external_full_name = validated_data.pop("external_full_name", None)
        external_phone = validated_data.pop("external_phone", None)
        external_email = validated_data.pop("external_email", None)
        external_business_name = validated_data.pop("external_business_name", None)
        external_document_type = validated_data.pop("external_document_type", None)
        external_id_number = validated_data.pop("external_id_number", None)
        external_document_file = validated_data.pop("external_document_file", None)

        is_admin = bool(
            user and user.is_authenticated and (
                user.is_superuser or getattr(user, "role", None) == "admin"
            )
        )
        is_owner = bool(
            user and user.is_authenticated and getattr(user, "role", None) == "owner"
        )

        validated_data["owner"] = None
        validated_data["external_landlord"] = None

        if is_owner and not is_admin:
            validated_data["owner"] = user

        elif is_admin:
            if owner_user_id:
                validated_data["owner"] = User.objects.get(id=owner_user_id)

            elif external_landlord_id:
                validated_data["external_landlord"] = ExternalLandlord.objects.get(id=external_landlord_id)

            else:
                external_landlord = ExternalLandlord.objects.create(
                    full_name=external_full_name,
                    phone=external_phone,
                    email=external_email,
                    business_name=external_business_name,
                    document_type=external_document_type,
                    id_number=external_id_number,
                    document_file=external_document_file,
                    created_by=user,
                )
                validated_data["external_landlord"] = external_landlord

        property_obj = Property.objects.create(**validated_data)

        if request:
            for image in request.FILES.getlist("property_images"):
                PropertyImage.objects.create(property=property_obj, image=image)

        # ── Notify all admins of new property submission ───────────────
        owner_name = property_obj.owner_name or "Unknown"
        _notify_admins(
            message=f"New property submitted for approval: '{property_obj.property_name}' by {owner_name}.",
            notification_type="property_submitted",
            property_id=property_obj.id,
        )

        return property_obj

    def update(self, instance, validated_data):
        ownership_fields = [
            "owner_user_id",
            "external_landlord_id",
            "external_full_name",
            "external_phone",
            "external_email",
            "external_business_name",
            "external_document_type",
            "external_id_number",
            "external_document_file",
            "owner",
            "external_landlord",
            "approval_status",
            "is_featured",
            "approved_by",
            "approved_at",
        ]

        for field in ownership_fields:
            validated_data.pop(field, None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance