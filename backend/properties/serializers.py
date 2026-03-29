import hashlib
import json
import logging
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import ExternalLandlord, Favorite, Property, PropertyImage, PropertyDuplicateMatch, Room
from .security import check_duplicate_property
from users.models import User
from notifications.sms import send_booking_created_sms

logger = logging.getLogger(__name__)


def _notify_admins(message, notification_type, property_id=None):
    from notifications.utils import send_notification
    admins = User.objects.filter(role="admin", is_active=True)
    for admin in admins:
        send_notification(
            user=admin,
            message=message,
            notification_type=notification_type,
            property_id=property_id,
        )


def _generate_file_hash(file_obj):
    hasher = hashlib.sha256()
    current_position = None
    if hasattr(file_obj, "tell"):
        try:
            current_position = file_obj.tell()
        except Exception:
            current_position = None
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0)
        except Exception:
            pass
    for chunk in file_obj.chunks():
        hasher.update(chunk)
    if hasattr(file_obj, "seek"):
        try:
            file_obj.seek(0 if current_position is None else current_position)
        except Exception:
            pass
    return hasher.hexdigest()


def _get_user_roles(user):
    if not (user and user.is_authenticated):
        return False, False
    is_admin = user.is_superuser or getattr(user, "role", None) == "admin"
    is_owner = getattr(user, "role", None) == "owner"
    return is_admin, is_owner


# ------------------------------------------------------------------ #
#  Room serializer                                                     #
# ------------------------------------------------------------------ #

class RoomSerializer(serializers.ModelSerializer):
    available_spaces = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            "id",
            "room_number",
            "room_type",
            "gender_restriction",
            "max_capacity",
            "occupied_spaces",
            "available_spaces",
            "is_available",
            "price_override",
            "effective_price",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "occupied_spaces",
            "available_spaces",
            "is_available",
            "created_at",
            "updated_at",
        ]

    def get_available_spaces(self, obj):
        return obj.available_spaces()

    def get_effective_price(self, obj):
        """Return price_override if set, otherwise fall back to property price."""
        return obj.price_override if obj.price_override is not None else obj.property.price

    def validate(self, attrs):
        # On create, property comes from the URL (view injects it via context).
        # On update, we use self.instance.property.
        property_obj = self.context.get("property") or (
            self.instance.property if self.instance else None
        )

        if property_obj and property_obj.category != "hostel":
            raise serializers.ValidationError(
                "Rooms can only be added to hostel properties."
            )

        max_capacity = attrs.get(
            "max_capacity",
            self.instance.max_capacity if self.instance else None,
        )
        if max_capacity is not None and not (1 <= max_capacity <= 6):
            raise serializers.ValidationError({
                "max_capacity": "Room capacity must be between 1 and 6."
            })

        return attrs

    def validate_room_number(self, value):
        property_obj = self.context.get("property") or (
            self.instance.property if self.instance else None
        )
        if property_obj:
            qs = Room.objects.filter(property=property_obj, room_number=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    f"Room '{value}' already exists in this property."
                )
        return value

    def create(self, validated_data):
        property_obj = self.context["property"]
        return Room.objects.create(property=property_obj, **validated_data)


# ------------------------------------------------------------------ #
#  Existing serializers (unchanged except PropertySerializer)         #
# ------------------------------------------------------------------ #

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


class PropertyDuplicateMatchSerializer(serializers.ModelSerializer):
    matched_property_id = serializers.IntegerField(source="matched_property.id", read_only=True)
    matched_property_name = serializers.CharField(source="matched_property.property_name", read_only=True)

    class Meta:
        model = PropertyDuplicateMatch
        fields = [
            "id",
            "matched_property_id",
            "matched_property_name",
            "match_reason",
            "match_score",
            "created_at",
        ]


class ExternalLandlordSerializer(serializers.ModelSerializer):
    properties_count = serializers.SerializerMethodField()
    document_file = serializers.SerializerMethodField()

    class Meta:
        model = ExternalLandlord
        fields = [
            "id", "full_name", "phone", "email", "business_name",
            "document_type", "id_number", "document_file",
            "is_verified", "properties_count", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "is_verified", "properties_count", "created_at", "updated_at",
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
        fields = ["id", "name", "email", "phone", "is_verified"]

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
    duplicate_matches = PropertyDuplicateMatchSerializer(many=True, read_only=True)
    amenities = FlexibleJSONField(required=False)

    # NEW: rooms are read-only here — created/managed via RoomSerializer
    rooms = RoomSerializer(many=True, read_only=True)

    # NEW: hostel-level capacity summary, derived from rooms
    total_capacity = serializers.SerializerMethodField()
    total_occupied = serializers.SerializerMethodField()
    total_available = serializers.SerializerMethodField()

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
    support_session_id = serializers.IntegerField(write_only=True, required=False)

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
            
"support_session_id",

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
            "security_flagged",
            "security_flag_type",
            "security_flag_reason",
            "security_flagged_at",
            "security_under_review",
            "rooms",
            "total_capacity",
            "total_occupied",
            "total_available",
            "images",
            "duplicate_matches",
            "created_at",
            "updated_at",
            "support_session_id",
            "reported_count",
"report_flag_status",
"report_flagged",
"report_flagged_at",
"report_flag_reason_summary",
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
            "security_flagged",
            "security_flag_type",
            "security_flag_reason",
            "security_flagged_at",
            "security_under_review",
            "duplicate_matches",
            "rooms",
            "total_capacity",
            "total_occupied",
            "total_available",
            "created_at",
            "updated_at",
            "reported_count",
"report_flag_status",
"report_flagged",
"report_flagged_at",
"report_flag_reason_summary",
        ]

    # ------------------------------------------------------------------ #
    #  Capacity summary helpers (hostel only, null for house_rent)        #
    # ------------------------------------------------------------------ #

    def get_total_capacity(self, obj):
        if obj.category != "hostel":
            return None
        return sum(r.max_capacity for r in obj.rooms.all())

    def get_total_occupied(self, obj):
        if obj.category != "hostel":
            return None
        return sum(r.occupied_spaces for r in obj.rooms.all())

    def get_total_available(self, obj):
        if obj.category != "hostel":
            return None
        return sum(r.available_spaces() for r in obj.rooms.all())

    # ------------------------------------------------------------------ #
    #  Read helpers (unchanged)                                           #
    # ------------------------------------------------------------------ #

    def get_owner_reference_id(self, obj):
        if obj.owner:
            return obj.owner.id
        if obj.external_landlord:
            return obj.external_landlord.id
        return None

    def get_owner_name(self, obj):  return obj.owner_name
    def get_owner_phone(self, obj): return obj.owner_phone
    def get_owner_email(self, obj): return obj.owner_email

    def get_owner_source(self, obj):
        if obj.owner:             return "registered"
        if obj.external_landlord: return "external"
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            full_name = f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip()
            return full_name or obj.approved_by.username
        return None

    # ------------------------------------------------------------------ #
    #  Internal validation helpers (unchanged)                            #
    # ------------------------------------------------------------------ #

    def _extract_external_fields(self, attrs):
        return {
            "full_name":     attrs.get("external_full_name", "").strip(),
            "phone":         attrs.get("external_phone", ""),
            "email":         attrs.get("external_email", ""),
            "business_name": attrs.get("external_business_name", ""),
            "document_type": attrs.get("external_document_type", "").strip(),
            "id_number":     attrs.get("external_id_number", "").strip(),
            "document_file": attrs.get("external_document_file"),
        }

    def _has_new_external_data(self, external):
        return bool(
            external["full_name"] or external["document_type"]
            or external["id_number"] or external["document_file"]
        )

    def _validate_registered_owner(self, owner_user_id):
        try:
            owner_user = User.objects.get(id=owner_user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({"owner_user_id": "Selected owner does not exist."})
        if getattr(owner_user, "role", None) != "owner" and not owner_user.is_superuser:
            raise serializers.ValidationError({"owner_user_id": "Selected user is not a registered owner."})
        return owner_user

    def _validate_existing_external_landlord(self, external_landlord_id):
        try:
            return ExternalLandlord.objects.get(id=external_landlord_id)
        except ExternalLandlord.DoesNotExist:
            raise serializers.ValidationError(
                {"external_landlord_id": "Selected external landlord does not exist."}
            )

    def _validate_new_external_landlord_data(self, external):
        if not external["full_name"]:
            raise serializers.ValidationError({"external_full_name": "Full name is required."})
        if not external["document_type"]:
            raise serializers.ValidationError({"external_document_type": "Document type is required."})
        if not external["id_number"]:
            raise serializers.ValidationError({"external_id_number": "ID number is required."})
        if not external["document_file"]:
            raise serializers.ValidationError({"external_document_file": "Document file is required."})
        if ExternalLandlord.objects.filter(id_number=external["id_number"]).exists():
            raise serializers.ValidationError({
                "external_id_number": (
                    "This ID number is already registered. Use external_landlord_id instead."
                )
            })

    # ------------------------------------------------------------------ #
    #  validate() / create() / update()                                   #
    # ------------------------------------------------------------------ #

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None
        instance = getattr(self, "instance", None)
        is_admin, is_owner = _get_user_roles(user)

        owner_user_id = attrs.get("owner_user_id")
        external_landlord_id = attrs.get("external_landlord_id")
        external = self._extract_external_fields(attrs)
        creating_new_external = self._has_new_external_data(external)

        ownership_fields_present = any([
            owner_user_id is not None,
            external_landlord_id is not None,
            creating_new_external,
        ])

        if instance is not None:
            if ownership_fields_present:
                raise serializers.ValidationError(
                    "Ownership cannot be changed through update. Use a dedicated transfer flow."
                )
            if not (is_admin or is_owner):
                raise serializers.ValidationError("You are not allowed to update this property.")
            attrs["_is_admin"] = is_admin
            attrs["_is_owner"] = is_owner
            return attrs

        if is_owner and not is_admin:
            if ownership_fields_present:
                raise serializers.ValidationError({"detail": "Owners can only create properties for themselves."})
            attrs["_is_admin"] = False
            attrs["_is_owner"] = True
            return attrs

        if is_admin:
            support_session_id = attrs.get("support_session_id")

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
                from support.models import AdminSupportSession

                owner = self._validate_registered_owner(owner_user_id)

                if not support_session_id:
                    raise serializers.ValidationError({
                        "support_session_id": "Support session is required for admin-assisted creation."
                    })

                try:
                    session = AdminSupportSession.objects.get(
                        id=support_session_id,
                        admin=user,
                        owner=owner,
                        status=AdminSupportSession.STATUS_ACTIVE,
                    )
                except AdminSupportSession.DoesNotExist:
                    raise serializers.ValidationError({
                        "support_session_id": "Invalid or inactive support session."
                    })

                if not session.expires_at or session.expires_at <= timezone.now():
                    session.mark_expired()
                    raise serializers.ValidationError({
                        "support_session_id": "This support session has expired."
                    })

                attrs["_resolved_owner"] = owner
                attrs["_support_session"] = session
                

            if external_landlord_id:
                attrs["_resolved_external_landlord"] = self._validate_existing_external_landlord(external_landlord_id)

            if creating_new_external:
                self._validate_new_external_landlord_data(external)
                attrs["_new_external_data"] = external

            attrs["_is_admin"] = True
            attrs["_is_owner"] = False
            return attrs

        raise serializers.ValidationError("You are not allowed to create a property.")




    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None
        is_admin = validated_data.pop("_is_admin", False)
        validated_data.pop("_is_owner", None)

        validated_data.pop("owner_user_id", None)
        validated_data.pop("external_landlord_id", None)
        validated_data.pop("external_full_name", None)
        validated_data.pop("external_phone", None)
        validated_data.pop("external_email", None)
        validated_data.pop("external_business_name", None)
        validated_data.pop("external_document_type", None)
        validated_data.pop("external_id_number", None)
        validated_data.pop("external_document_file", None)
        validated_data.pop("support_session_id", None)
        resolved_owner = validated_data.pop("_resolved_owner", None)
        resolved_external_landlord = validated_data.pop("_resolved_external_landlord", None)
        new_external_data = validated_data.pop("_new_external_data", None)
        support_session = validated_data.pop("_support_session", None)

       
        is_owner_role = not is_admin and bool(
            user and user.is_authenticated and getattr(user, "role", None) == "owner"
        )

        if is_owner_role:
            validated_data["owner"] = user
            validated_data["external_landlord"] = None
        elif is_admin:
            if resolved_owner:
                validated_data["owner"] = resolved_owner
                validated_data["external_landlord"] = None
                validated_data["created_by_admin"] = user
                validated_data["support_session"] = support_session
            elif resolved_external_landlord:
                validated_data["owner"] = None
                validated_data["external_landlord"] = resolved_external_landlord
            else:
                ext = new_external_data
                with transaction.atomic():
                    external_landlord_obj = ExternalLandlord.objects.create(
                        full_name=ext["full_name"],
                        phone=ext["phone"],
                        email=ext["email"],
                        business_name=ext["business_name"],
                        document_type=ext["document_type"],
                        id_number=ext["id_number"],
                        document_file=ext["document_file"],
                        created_by=user,
                    )
                    validated_data["owner"] = None
                    validated_data["external_landlord"] = external_landlord_obj
                    property_obj = Property(**validated_data)
                    property_obj.full_clean()
                    property_obj.save()
                    self._save_property_images(request, property_obj)

                _prop_id = property_obj.id
                _prop_name = property_obj.property_name
                _owner_name = property_obj.owner_name or "Unknown"
                transaction.on_commit(lambda: _notify_admins(
                    message=f"New property submitted for approval: '{_prop_name}' by {_owner_name}.",
                    notification_type="property_submitted",
                    property_id=_prop_id,
                ))
                transaction.on_commit(lambda: check_duplicate_property(Property.objects.get(pk=_prop_id)))
                return property_obj

        with transaction.atomic():
            property_obj = Property(**validated_data)
            property_obj.full_clean()
            property_obj.save()
            self._save_property_images(request, property_obj)

        _prop_id = property_obj.id
        _prop_name = property_obj.property_name
        _owner_name = property_obj.owner_name or "Unknown"
        transaction.on_commit(lambda: _notify_admins(
            message=f"New property submitted for approval: '{_prop_name}' by {_owner_name}.",
            notification_type="property_submitted",
            property_id=_prop_id,
        ))
        transaction.on_commit(lambda: check_duplicate_property(Property.objects.get(pk=_prop_id)))
        return property_obj
    
    

   
   
   
   
    def _save_property_images(self, request, property_obj):
        if not request:
            return
        for image in request.FILES.getlist("property_images"):
            image_hash = _generate_file_hash(image)
            PropertyImage.objects.create(
                property=property_obj,
                image=image,
                image_hash=image_hash,
            )

    def update(self, instance, validated_data):
        protected_fields = [
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
            "security_flagged",
            "security_flag_type",
            "security_flag_reason",
            "security_flagged_at",
            "security_under_review",
            "_is_admin",
            "_is_owner",
            "_resolved_owner",
            "_resolved_external_landlord",
            "_new_external_data",
        ]

        for field in protected_fields:
            if field in validated_data:
                logger.warning(
                    "PropertySerializer.update() received protected field '%s' for property pk=%s — ignoring.",
                    field,
                    instance.pk,
                )
                validated_data.pop(field)

        request = self.context.get("request")
        new_images = request.FILES.getlist("property_images") if request else []

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            instance.full_clean()
            instance.save()

            if new_images:
                instance.images.all().delete()
                self._save_property_images(request, instance)

        return instance


# ------------------------------------------------------------------ #
#  Favorite serializer (unchanged)                                    #
# ------------------------------------------------------------------ #

class FavoriteSerializer(serializers.ModelSerializer):
    property = PropertySerializer(read_only=True)
    property_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "property", "property_id", "created_at"]
        read_only_fields = ["id", "property", "created_at"]

    def validate_property_id(self, value):
        try:
            property_obj = Property.objects.get(id=value, approval_status="approved")
        except Property.DoesNotExist:
            raise serializers.ValidationError("Property not found or not approved.")
        self._validated_property = property_obj
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data.pop("property_id")
        property_obj = getattr(self, "_validated_property", None)
        if property_obj is None:
            raise serializers.ValidationError("Property could not be resolved.")
        favorite, _ = Favorite.objects.get_or_create(user=user, property=property_obj)
        return favorite