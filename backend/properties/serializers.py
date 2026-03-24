import hashlib
import json
import logging

from django.db import transaction
from rest_framework import serializers

from .models import ExternalLandlord, Favorite, Property, PropertyImage, PropertyDuplicateMatch
from .security import check_duplicate_property
from users.models import User

logger = logging.getLogger(__name__)


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


def _generate_file_hash(file_obj):
    """
    Generate a stable SHA-256 hash for an uploaded file without breaking reuse.
    """
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
    """
    Centralized helper — compute is_admin / is_owner once and reuse
    across validate() and create(). Avoids duplicating the same boolean
    expression in multiple methods.
    """
    if not (user and user.is_authenticated):
        return False, False

    is_admin = user.is_superuser or getattr(user, "role", None) == "admin"
    is_owner = getattr(user, "role", None) == "owner"
    return is_admin, is_owner


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
    duplicate_matches = PropertyDuplicateMatchSerializer(many=True, read_only=True)
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
            "security_flagged",
            "security_flag_type",
            "security_flag_reason",
            "security_flagged_at",
            "security_under_review",
            "images",
            "duplicate_matches",
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
            "security_flagged",
            "security_flag_type",
            "security_flag_reason",
            "security_flagged_at",
            "security_under_review",
            "duplicate_matches",
            "created_at",
            "updated_at",
        ]

    # ------------------------------------------------------------------ #
    #  Read helpers                                                        #
    # ------------------------------------------------------------------ #

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

    # ------------------------------------------------------------------ #
    #  Internal validation helpers                                        #
    # ------------------------------------------------------------------ #

    def _extract_external_fields(self, attrs):
        """
        Pull external landlord fields out of attrs and return them as a
        plain dict so we don't repeat the same .get()/.strip() calls in
        multiple methods.
        """
        return {
            "full_name": attrs.get("external_full_name", "").strip(),
            "phone": attrs.get("external_phone", ""),
            "email": attrs.get("external_email", ""),
            "business_name": attrs.get("external_business_name", ""),
            "document_type": attrs.get("external_document_type", "").strip(),
            "id_number": attrs.get("external_id_number", "").strip(),
            "document_file": attrs.get("external_document_file"),
        }

    def _has_new_external_data(self, external):
        """True if the caller is trying to create a brand-new ExternalLandlord inline."""
        return bool(
            external["full_name"]
            or external["document_type"]
            or external["id_number"]
            or external["document_file"]
        )

    def _validate_registered_owner(self, owner_user_id):
        """
        Confirm the user exists and has the owner role.
        Returns the User object so we can stash it and skip the second DB hit.
        """
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
        """
        Confirm the ExternalLandlord exists.
        Returns the object so we can stash it and skip the second DB hit.
        """
        try:
            return ExternalLandlord.objects.get(id=external_landlord_id)
        except ExternalLandlord.DoesNotExist:
            raise serializers.ValidationError({
                "external_landlord_id": "Selected external landlord does not exist."
            })

    def _validate_new_external_landlord_data(self, external):
        """Validate all required fields for creating a brand-new ExternalLandlord."""
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
                    "This ID number is already registered. "
                    "Use external_landlord_id instead."
                )
            })

    # ------------------------------------------------------------------ #
    #  validate()                                                         #
    # ------------------------------------------------------------------ #

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None
        instance = getattr(self, "instance", None)

        # Resolve roles once — reused below and stored in attrs for create().
        is_admin, is_owner = _get_user_roles(user)

        owner_user_id = attrs.get("owner_user_id")
        external_landlord_id = attrs.get("external_landlord_id")

        # Extract external fields once so both _has_new_external_data
        # and _validate_new_external_landlord_data use the same values.
        external = self._extract_external_fields(attrs)
        creating_new_external = self._has_new_external_data(external)

        ownership_fields_present = any([
            owner_user_id is not None,
            external_landlord_id is not None,
            creating_new_external,
        ])

        # ---- UPDATE path ----
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

        # ---- CREATE path — owner (non-admin) ----
        if is_owner and not is_admin:
            if ownership_fields_present:
                raise serializers.ValidationError({
                    "detail": "Owners can only create properties for themselves."
                })
            attrs["_is_admin"] = False
            attrs["_is_owner"] = True
            return attrs

        # ---- CREATE path — admin ----
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

            # FIX: validate AND store resolved objects to avoid a second
            # DB round-trip (and a TOCTOU window) inside create().
            if owner_user_id:
                attrs["_resolved_owner"] = self._validate_registered_owner(owner_user_id)

            if external_landlord_id:
                attrs["_resolved_external_landlord"] = self._validate_existing_external_landlord(
                    external_landlord_id
                )

            if creating_new_external:
                self._validate_new_external_landlord_data(external)
                # Store the cleaned external data so create() doesn't need
                # to re-extract it from the raw attrs.
                attrs["_new_external_data"] = external

            attrs["_is_admin"] = True
            attrs["_is_owner"] = False
            return attrs

        raise serializers.ValidationError("You are not allowed to create a property.")

    # ------------------------------------------------------------------ #
    #  create()                                                           #
    # ------------------------------------------------------------------ #

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        # Pop internal bookkeeping keys added during validate().
        is_admin = validated_data.pop("_is_admin", False)
        validated_data.pop("_is_owner", None)

        # Pop all ownership-related write fields (including the raw ones
        # that were already resolved into _resolved_* during validate()).
        owner_user_id = validated_data.pop("owner_user_id", None)           # noqa: F841 — resolved below
        external_landlord_id = validated_data.pop("external_landlord_id", None)  # noqa: F841

        external_full_name = validated_data.pop("external_full_name", None)
        external_phone = validated_data.pop("external_phone", None)
        external_email = validated_data.pop("external_email", None)
        external_business_name = validated_data.pop("external_business_name", None)
        external_document_type = validated_data.pop("external_document_type", None)
        external_id_number = validated_data.pop("external_id_number", None)
        external_document_file = validated_data.pop("external_document_file", None)

        # Pre-resolved objects from validate() — no extra DB queries needed.
        resolved_owner = validated_data.pop("_resolved_owner", None)
        resolved_external_landlord = validated_data.pop("_resolved_external_landlord", None)
        new_external_data = validated_data.pop("_new_external_data", None)

        is_owner_role = not is_admin and bool(
            user and user.is_authenticated and getattr(user, "role", None) == "owner"
        )

        # FIX: build the ownership assignment completely before touching the DB.
        # The old pattern set both FKs to None first, then conditionally overwrote
        # one — meaning there was always a window where both were null, which
        # violates the CheckConstraint if anything raised mid-way.
        # Now we resolve the final assignment in one clean block and apply it once.
        if is_owner_role:
            validated_data["owner"] = user
            validated_data["external_landlord"] = None

        elif is_admin:
            if resolved_owner:
                validated_data["owner"] = resolved_owner
                validated_data["external_landlord"] = None

            elif resolved_external_landlord:
                validated_data["owner"] = None
                validated_data["external_landlord"] = resolved_external_landlord

            else:
                # Brand-new ExternalLandlord — use the pre-validated dict.
                ext = new_external_data or {
                    "full_name": external_full_name,
                    "phone": external_phone,
                    "email": external_email,
                    "business_name": external_business_name,
                    "document_type": external_document_type,
                    "id_number": external_id_number,
                    "document_file": external_document_file,
                }

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

                    # FIX: call full_clean() inside the atomic block so model-level
                    # constraint violations (e.g. exactly-one-owner, is_featured rules)
                    # are caught with a clean ValidationError at the API layer, not as
                    # a raw IntegrityError at the DB layer.
                    property_obj = Property(**validated_data)
                    property_obj.full_clean()
                    property_obj.save()
                    self._save_property_images(request, property_obj)

                owner_name = property_obj.owner_name or "Unknown"
                _prop_id_1 = property_obj.id
                _prop_name_1 = property_obj.property_name
                transaction.on_commit(lambda: _notify_admins(
                    message=f"New property submitted for approval: '{_prop_name_1}' by {owner_name}.",
                    notification_type="property_submitted",
                    property_id=_prop_id_1,
                ))
                # Wire duplicate check — runs after commit, off the request thread.
                transaction.on_commit(lambda: check_duplicate_property(
                    Property.objects.get(pk=_prop_id_1)
                ))
                return property_obj

        # Owner-role and admin-with-registered/existing-external paths.
        with transaction.atomic():
            property_obj = Property(**validated_data)
            property_obj.full_clean()
            property_obj.save()
            self._save_property_images(request, property_obj)

        owner_name = property_obj.owner_name or "Unknown"
        _prop_id_2 = property_obj.id
        _prop_name_2 = property_obj.property_name
        transaction.on_commit(lambda: _notify_admins(
            message=f"New property submitted for approval: '{_prop_name_2}' by {owner_name}.",
            notification_type="property_submitted",
            property_id=_prop_id_2,
        ))
        # Wire duplicate check — runs after commit, off the request thread.
        transaction.on_commit(lambda: check_duplicate_property(
            Property.objects.get(pk=_prop_id_2)
        ))
        return property_obj

    # ------------------------------------------------------------------ #
    #  update()                                                           #
    # ------------------------------------------------------------------ #

    def update(self, instance, validated_data):
        # These fields must never be changed through a standard update.
        # We pop them explicitly and log a warning if any actually arrived
        # in validated_data — that would indicate a bug upstream (e.g. a
        # read_only_fields misconfiguration or a subclass mistake).
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
            # Internal bookkeeping keys from validate()
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

        with transaction.atomic():
            # FIX: handle image replacement on update.
            # If the client sends new images we replace the existing set.
            # If no images are sent the existing images are left untouched.
            if request and request.FILES.getlist("property_images"):
                instance.images.all().delete()
                self._save_property_images(request, instance)

            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            # FIX: call full_clean() before save() so model-level validation
            # (clean(), field validators) is enforced at the API layer with a
            # clean error response, not as a raw DB IntegrityError.
            instance.full_clean()
            instance.save()

        return instance

    # ------------------------------------------------------------------ #
    #  Shared image helper                                                #
    # ------------------------------------------------------------------ #

    def _save_property_images(self, request, property_obj):
        """
        Persist uploaded images for a property.
        Extracted into a shared helper so create() and update() stay DRY.
        """
        if not request:
            return
        for image in request.FILES.getlist("property_images"):
            image_hash = _generate_file_hash(image)
            PropertyImage.objects.create(
                property=property_obj,
                image=image,
                image_hash=image_hash,
            )


class FavoriteSerializer(serializers.ModelSerializer):
    property = PropertySerializer(read_only=True)
    property_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Favorite
        fields = ["id", "property", "property_id", "created_at"]
        read_only_fields = ["id", "property", "created_at"]

    def validate_property_id(self, value):
        # FIX: fetch and cache the property object here rather than doing a
        # separate lookup inside create(). This eliminates the race condition
        # where the property could be deleted or unapproved between validation
        # and creation, which would cause an unhandled DoesNotExist crash.
        try:
            property_obj = Property.objects.get(id=value, approval_status="approved")
        except Property.DoesNotExist:
            raise serializers.ValidationError("Property not found or not approved.")

        # Stash on the serializer instance so create() can use it directly.
        self._validated_property = property_obj
        return value

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data.pop("property_id")

        # FIX: use the object already fetched during validation instead of
        # hitting the DB again with a fresh .get() that could raise DoesNotExist.
        property_obj = getattr(self, "_validated_property", None)
        if property_obj is None:
            # Should never reach here in normal flow, but be defensive.
            raise serializers.ValidationError("Property could not be resolved.")

        favorite, _ = Favorite.objects.get_or_create(
            user=user,
            property=property_obj,
        )
        return favorite