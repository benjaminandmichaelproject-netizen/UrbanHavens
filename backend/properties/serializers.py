import hashlib
import json
import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from notifications.sms import send_booking_created_sms
from system_logs.logger import log_property_event
from users.models import User

from .models import (
    ApartmentUnit,
    ExternalLandlord,
    Favorite,
    Property,
    PropertyDuplicateMatch,
    PropertyImage,
    Room,
)
from .security import check_duplicate_property
from .utils.image_compression import compress_property_image


logger = logging.getLogger(__name__)


def _notify_admins(message, notification_type, property_id=None):
    """
    Sends a notification to every active UrbanHavens administrator.
    """
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
    Generates a SHA-256 hash without permanently changing the
    uploaded file's current read position.
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
            file_obj.seek(
                0 if current_position is None else current_position
            )
        except Exception:
            pass

    return hasher.hexdigest()


def _get_user_roles(user):
    """
    Resolves the two property-management roles used by this serializer.
    """
    if not (user and user.is_authenticated):
        return False, False

    is_admin = (
        user.is_superuser
        or getattr(user, "role", None) == "admin"
    )
    is_owner = getattr(user, "role", None) == "owner"

    return is_admin, is_owner


# ------------------------------------------------------------------ #
#  Room serializer                                                   #
# ------------------------------------------------------------------ #


class RoomSerializer(serializers.ModelSerializer):
    """
    Handles individual hostel rooms without changing the existing
    hostel workflow.
    """

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
        if obj.price_override is not None:
            return obj.price_override

        return obj.property.price

    def validate(self, attrs):
        property_obj = self.context.get("property") or (
            self.instance.property
            if self.instance
            else None
        )

        if (
            property_obj
            and property_obj.category != "hostel"
        ):
            raise serializers.ValidationError(
                "Rooms can only be added to hostel properties."
            )

        max_capacity = attrs.get(
            "max_capacity",
            self.instance.max_capacity
            if self.instance
            else None,
        )

        if (
            max_capacity is not None
            and not (1 <= max_capacity <= 6)
        ):
            raise serializers.ValidationError(
                {
                    "max_capacity": (
                        "Room capacity must be between 1 and 6."
                    )
                }
            )

        return attrs

    def validate_room_number(self, value):
        property_obj = self.context.get("property") or (
            self.instance.property
            if self.instance
            else None
        )

        if property_obj:
            qs = Room.objects.filter(
                property=property_obj,
                room_number=value,
            )

            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    f"Room '{value}' already exists in this property."
                )

        return value

    def create(self, validated_data):
        property_obj = self.context["property"]

        return Room.objects.create(
            property=property_obj,
            **validated_data,
        )


# ------------------------------------------------------------------ #
#  Property image serializer                                         #
# ------------------------------------------------------------------ #


class PropertyImageSerializer(serializers.ModelSerializer):
    """
    Returns absolute image URLs whenever a request is available.
    """

    image = serializers.SerializerMethodField()

    class Meta:
        model = PropertyImage
        fields = [
            "id",
            "image",
        ]

    def get_image(self, obj):
        request = self.context.get("request")

        if obj.image:
            if request:
                return request.build_absolute_uri(
                    obj.image.url
                )

            return obj.image.url

        return None


# ------------------------------------------------------------------ #
#  Duplicate-property serializer                                     #
# ------------------------------------------------------------------ #


class PropertyDuplicateMatchSerializer(
    serializers.ModelSerializer
):
    """
    Returns basic information about a possible duplicate property.
    """

    matched_property_id = serializers.IntegerField(
        source="matched_property.id",
        read_only=True,
    )
    matched_property_name = serializers.CharField(
        source="matched_property.property_name",
        read_only=True,
    )

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


# ------------------------------------------------------------------ #
#  External landlord serializer                                      #
# ------------------------------------------------------------------ #


class ExternalLandlordSerializer(serializers.ModelSerializer):
    """
    Returns external landlord details and the number of properties
    currently linked to that landlord.
    """

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
            if request:
                return request.build_absolute_uri(
                    obj.document_file.url
                )

            return obj.document_file.url

        return None


# ------------------------------------------------------------------ #
#  Registered landlord serializer                                    #
# ------------------------------------------------------------------ #


class RegisteredLandlordSerializer(
    serializers.ModelSerializer
):
    """
    Returns the limited registered-owner information required by
    the property and admin workflows.
    """

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
        full_name = (
            f"{obj.first_name} {obj.last_name}"
        ).strip()

        return full_name or obj.username

    def get_is_verified(self, obj):
        profile = getattr(
            obj,
            "landlord_profile",
            None,
        )

        return profile.is_verified if profile else False


# ------------------------------------------------------------------ #
#  Flexible JSON field                                               #
# ------------------------------------------------------------------ #


class FlexibleJSONField(serializers.Field):
    """
    Accepts normal JSON values as well as JSON strings coming from
    multipart/form-data requests.
    """

    def to_internal_value(self, data):
        if data in [None, "", []]:
            return []

        if isinstance(data, (list, dict)):
            return data

        if isinstance(data, str):
            try:
                parsed = json.loads(data)
            except json.JSONDecodeError:
                raise serializers.ValidationError(
                    "Invalid JSON string."
                )

            if not isinstance(parsed, (list, dict)):
                raise serializers.ValidationError(
                    "Must be a JSON array or object."
                )

            return parsed

        raise serializers.ValidationError(
            "Unsupported type for JSON field."
        )

    def to_representation(self, value):
        if value in [None, ""]:
            return []

        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value

        return value


# ------------------------------------------------------------------ #
#  Apartment unit serializer                                         #
# ------------------------------------------------------------------ #


class ApartmentUnitSerializer(serializers.ModelSerializer):
    """
    Handles one separately rentable apartment inside a multi-unit
    apartment property.

    The unit's reserved/occupied state remains system-controlled.
    Owners create and edit the descriptive unit information only.
    """

    amenities = FlexibleJSONField(required=False)
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = ApartmentUnit
        fields = [
            "id",
            "unit_number",
            "bedrooms",
            "bathrooms",
            "floor",
            "price",
            "is_furnished",
            "amenities",
            "status",
            "is_available",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "is_available",
            "created_at",
            "updated_at",
        ]

    def get_is_available(self, obj):
        """
        Gives the frontend a simple boolean while preserving the
        more precise available/reserved/occupied status internally.
        """
        return obj.status == "available"

    def validate(self, attrs):
        """
        Ensures units can only belong to multi-unit apartment
        properties.
        """
        property_obj = self.context.get("property") or (
            self.instance.property
            if self.instance
            else None
        )

        if property_obj:
            if property_obj.category != "apartment":
                raise serializers.ValidationError(
                    {
                        "property": (
                            "Apartment units can only be added "
                            "to apartment properties."
                        )
                    }
                )

            if (
                property_obj.apartment_listing_type
                != "multi_unit"
            ):
                raise serializers.ValidationError(
                    {
                        "property": (
                            "Apartment units can only be added "
                            "to multi-unit apartment properties."
                        )
                    }
                )

        return attrs

    def validate_unit_number(self, value):
        """
        Prevents duplicate unit names/numbers inside the same
        apartment property.
        """
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Unit number or name is required."
            )

        property_obj = self.context.get("property") or (
            self.instance.property
            if self.instance
            else None
        )

        if property_obj:
            qs = ApartmentUnit.objects.filter(
                property=property_obj,
                unit_number=value,
            )

            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    (
                        f"Apartment unit '{value}' already "
                        "exists in this property."
                    )
                )

        return value

    def validate_price(self, value):
        """
        Prevents apartment units from being created with zero or
        negative rent.
        """
        if value <= 0:
            raise serializers.ValidationError(
                "Apartment unit price must be greater than zero."
            )

        return value

    def create(self, validated_data):
        """
        Creates the unit under the parent apartment supplied by
        the apartment-unit API.
        """
        property_obj = self.context["property"]

        return ApartmentUnit.objects.create(
            property=property_obj,
            **validated_data,
        )


# ------------------------------------------------------------------ #
#  Main property serializer                                          #
# ------------------------------------------------------------------ #


class PropertySerializer(serializers.ModelSerializer):
    """
    Main serializer used for UrbanHavens property creation,
    retrieval and editing.

    Existing house and hostel behaviour remains unchanged.
    Apartment-specific fields are added without altering old
    records.
    """

    images = PropertyImageSerializer(
        many=True,
        read_only=True,
    )

    duplicate_matches = PropertyDuplicateMatchSerializer(
        many=True,
        read_only=True,
    )

    amenities = FlexibleJSONField(required=False)

    allowed_rental_months = FlexibleJSONField(
        required=False
    )

    # Existing hostel rooms remain read-only here and continue
    # to be managed through the dedicated room API.
    rooms = RoomSerializer(
        many=True,
        read_only=True,
    )

    # Apartment units follow the same safe pattern as hostel rooms.
    # They are returned with the property but managed by their own API.
    apartment_units = ApartmentUnitSerializer(
        many=True,
        read_only=True,
    )

    total_capacity = serializers.SerializerMethodField()
    total_occupied = serializers.SerializerMethodField()
    total_available = serializers.SerializerMethodField()

    # Lowest relevant unit price for multi-unit apartment listings.
    starting_price = serializers.SerializerMethodField()

    owner_reference_id = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    owner_phone = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()
    owner_source = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    owner_user_id = serializers.IntegerField(
        write_only=True,
        required=False,
    )

    external_landlord_id = serializers.IntegerField(
        write_only=True,
        required=False,
    )

    external_full_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    external_phone = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    external_email = serializers.EmailField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    external_business_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    external_document_type = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    external_id_number = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    external_document_file = serializers.FileField(
        write_only=True,
        required=False,
        allow_null=True,
    )

    support_session_id = serializers.IntegerField(
        write_only=True,
        required=False,
    )

    class Meta:
        model = Property

        fields = [
            "id",

            # Owner information.
            "owner_reference_id",
            "owner_name",
            "owner_phone",
            "owner_email",
            "owner_source",
            "approved_by_name",

            # Admin-assisted owner selection.
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

            # Main property information.
            "property_name",
            "category",
            "apartment_listing_type",
            "property_type",
            "bedrooms",
            "bathrooms",
            "price",
            "starting_price",
            "description",
            "amenities",
            "allowed_rental_months",

            # Location.
            "region",
            "city",
            "school",
            "lat",
            "lng",

            # Availability and approval.
            "is_available",
            "approval_status",
            "is_featured",
            "approved_at",

            # Security moderation.
            "security_flagged",
            "security_flag_type",
            "security_flag_reason",
            "security_flagged_at",
            "security_under_review",

            # Hostel data.
            "rooms",
            "total_capacity",
            "total_occupied",
            "total_available",

            # Apartment data.
            "apartment_units",

            # Property images and duplicate detection.
            "images",
            "duplicate_matches",

            # Reporting/moderation data.
            "reported_count",
            "report_flag_status",
            "report_flagged",
            "report_flagged_at",
            "report_flag_reason_summary",

            # Timestamps.
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
            "rooms",
            "apartment_units",
            "total_capacity",
            "total_occupied",
            "total_available",
           "created_at",
            "updated_at",

            # Report moderation is controlled only by the reporting
            # and admin-review workflows, never by normal property edits.
            "reported_count",
            "report_flag_status",
            "report_flagged",
            "report_flagged_at",
            "report_flag_reason_summary",

            
        ]

    # ------------------------------------------------------------------ #
    #  Hostel capacity helpers                                          #
    # ------------------------------------------------------------------ #

    def get_total_capacity(self, obj):
        """
        Returns hostel capacity only. Other property types continue
        to receive null for this hostel-specific field.
        """
        if obj.category != "hostel":
            return None

        return sum(
            room.max_capacity
            for room in obj.rooms.all()
        )

    def get_total_occupied(self, obj):
        """
        Returns the number of occupied hostel spaces.
        """
        if obj.category != "hostel":
            return None

        return sum(
            room.occupied_spaces
            for room in obj.rooms.all()
        )

    def get_total_available(self, obj):
        """
        Returns the number of currently available hostel spaces.
        """
        if obj.category != "hostel":
            return None

        return sum(
            room.available_spaces()
            for room in obj.rooms.all()
        )

    # ------------------------------------------------------------------ #
    #  Apartment pricing helper                                        #
    # ------------------------------------------------------------------ #

    def get_starting_price(self, obj):
        """
        Returns the cheapest available unit price for a multi-unit
        apartment. If every unit is unavailable, falls back to the
        cheapest existing unit. Other property types return null.
        """
        if not (
            obj.category == "apartment"
            and obj.apartment_listing_type == "multi_unit"
        ):
            return None

        units = list(obj.apartment_units.all())

        available_prices = [
            unit.price
            for unit in units
            if unit.status == "available"
        ]

        prices = available_prices or [
            unit.price
            for unit in units
        ]

        if not prices:
            return None

        return f"{min(prices):.2f}"

    # ------------------------------------------------------------------ #
    #  Owner read helpers                                               #
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
            full_name = (
                f"{obj.approved_by.first_name} "
                f"{obj.approved_by.last_name}"
            ).strip()

            return full_name or obj.approved_by.username

        return None

    # ------------------------------------------------------------------ #
    #  Internal owner helpers                                           #
    # ------------------------------------------------------------------ #

    def _extract_external_fields(self, attrs):
        return {
            "full_name": attrs.get(
                "external_full_name",
                "",
            ).strip(),
            "phone": attrs.get(
                "external_phone",
                "",
            ),
            "email": attrs.get(
                "external_email",
                "",
            ),
            "business_name": attrs.get(
                "external_business_name",
                "",
            ),
            "document_type": attrs.get(
                "external_document_type",
                "",
            ).strip(),
            "id_number": attrs.get(
                "external_id_number",
                "",
            ).strip(),
            "document_file": attrs.get(
                "external_document_file"
            ),
        }

    def _has_new_external_data(self, external):
        return bool(
            external["full_name"]
            or external["document_type"]
            or external["id_number"]
            or external["document_file"]
        )

    def _validate_registered_owner(self, owner_user_id):
        try:
            owner_user = User.objects.get(
                id=owner_user_id
            )
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {
                    "owner_user_id": (
                        "Selected owner does not exist."
                    )
                }
            )

        if (
            getattr(owner_user, "role", None) != "owner"
            and not owner_user.is_superuser
        ):
            raise serializers.ValidationError(
                {
                    "owner_user_id": (
                        "Selected user is not a "
                        "registered owner."
                    )
                }
            )

        return owner_user

    def _validate_existing_external_landlord(
        self,
        external_landlord_id,
    ):
        try:
            return ExternalLandlord.objects.get(
                id=external_landlord_id
            )
        except ExternalLandlord.DoesNotExist:
            raise serializers.ValidationError(
                {
                    "external_landlord_id": (
                        "Selected external landlord "
                        "does not exist."
                    )
                }
            )

    def _validate_new_external_landlord_data(
        self,
        external,
    ):
        if not external["full_name"]:
            raise serializers.ValidationError(
                {
                    "external_full_name": (
                        "Full name is required."
                    )
                }
            )

        if not external["document_type"]:
            raise serializers.ValidationError(
                {
                    "external_document_type": (
                        "Document type is required."
                    )
                }
            )

        if not external["id_number"]:
            raise serializers.ValidationError(
                {
                    "external_id_number": (
                        "ID number is required."
                    )
                }
            )

        if not external["document_file"]:
            raise serializers.ValidationError(
                {
                    "external_document_file": (
                        "Document file is required."
                    )
                }
            )

        if ExternalLandlord.objects.filter(
            id_number=external["id_number"]
        ).exists():
            raise serializers.ValidationError(
                {
                    "external_id_number": (
                        "This ID number is already registered. "
                        "Use external_landlord_id instead."
                    )
                }
            )

    # ------------------------------------------------------------------ #
    #  Rental-duration validation                                       #
    # ------------------------------------------------------------------ #

    def validate_allowed_rental_months(self, value):
        if value in [None, []]:
            raise serializers.ValidationError(
                "Select at least one rental duration."
            )

        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Rental durations must be a list."
            )

        allowed = {
            6,
            12,
            18,
            24,
        }

        cleaned = []

        for month in value:
            try:
                month = int(month)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    "Rental duration must be a number."
                )

            if month not in allowed:
                raise serializers.ValidationError(
                    (
                        "Only 6, 12, 18 and 24 month "
                        "rentals are allowed."
                    )
                )

            if month not in cleaned:
                cleaned.append(month)

        if not cleaned:
            raise serializers.ValidationError(
                "Select at least one rental duration."
            )

        return cleaned

    # ------------------------------------------------------------------ #
    #  Apartment configuration validation                               #
    # ------------------------------------------------------------------ #

    def _validate_apartment_configuration(
        self,
        attrs,
        instance=None,
    ):
        # Validates apartment structure and conditionally requires
        # the parent-level rent fields.
        category = attrs.get(
            "category",
            instance.category
            if instance
            else None,
        )

        apartment_listing_type = attrs.get(
            "apartment_listing_type",
            instance.apartment_listing_type
            if instance
            else None,
        )

        # Every apartment must explicitly state whether it is one rentable
        # apartment or a building containing separately rentable units.
        if category == "apartment":
            if apartment_listing_type not in {
                "single",
                "multi_unit",
            }:
                raise serializers.ValidationError(
                    {
                        "apartment_listing_type": (
                            "Choose whether this is a single "
                            "apartment or a multi-unit "
                            "apartment property."
                        )
                    }
                )

        # Hostel and house records must not retain apartment-only settings.
        elif apartment_listing_type:
            if (
                instance is not None
                and "category" in attrs
                and category != "apartment"
            ):
                attrs["apartment_listing_type"] = None
                apartment_listing_type = None
            else:
                raise serializers.ValidationError(
                    {
                        "apartment_listing_type": (
                            "Apartment listing type can only "
                            "be used for apartment properties."
                        )
                    }
                )

        is_multi_unit_apartment = (
            category == "apartment"
            and apartment_listing_type == "multi_unit"
        )

        # A multi-unit parent is only the shared building/listing record.
        # Unit-specific bedrooms, bathrooms, and price belong to ApartmentUnit.
        if is_multi_unit_apartment:
            attrs["bedrooms"] = None
            attrs["bathrooms"] = None
            attrs["price"] = None
            return attrs

        # All other rental types keep the existing parent-field requirement.
        # On PATCH, an existing value remains valid when the field is omitted.
        required_fields = {
            "bedrooms": (
                attrs.get(
                    "bedrooms",
                    instance.bedrooms if instance else None,
                ),
                "Bedrooms are required for this property type.",
            ),
            "bathrooms": (
                attrs.get(
                    "bathrooms",
                    instance.bathrooms if instance else None,
                ),
                "Bathrooms are required for this property type.",
            ),
            "price": (
                attrs.get(
                    "price",
                    instance.price if instance else None,
                ),
                "Price is required for this property type.",
            ),
        }

        field_errors = {
            field_name: message
            for field_name, (value, message) in required_fields.items()
            if value is None
        }

        if field_errors:
            raise serializers.ValidationError(field_errors)

        return attrs

    # ------------------------------------------------------------------ #
    #  Main validation                                                  #
    # ------------------------------------------------------------------ #

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None

        instance = getattr(
            self,
            "instance",
            None,
        )

        is_admin, is_owner = _get_user_roles(user)

        # Validate the apartment fields before resolving ownership.
        attrs = self._validate_apartment_configuration(
            attrs,
            instance=instance,
        )

        owner_user_id = attrs.get("owner_user_id")
        external_landlord_id = attrs.get(
            "external_landlord_id"
        )

        external = self._extract_external_fields(attrs)

        creating_new_external = (
            self._has_new_external_data(external)
        )

        ownership_fields_present = any(
            [
                owner_user_id is not None,
                external_landlord_id is not None,
                creating_new_external,
            ]
        )

        # Existing property updates preserve the current owner.
        if instance is not None:
            if ownership_fields_present:
                raise serializers.ValidationError(
                    (
                        "Ownership cannot be changed through "
                        "update. Use a dedicated transfer flow."
                    )
                )

            if not (is_admin or is_owner):
                raise serializers.ValidationError(
                    (
                        "You are not allowed to update "
                        "this property."
                    )
                )

            attrs["_is_admin"] = is_admin
            attrs["_is_owner"] = is_owner

            return attrs

        # Normal property owners can only create properties
        # belonging to themselves.
        if is_owner and not is_admin:
            if ownership_fields_present:
                raise serializers.ValidationError(
                    {
                        "detail": (
                            "Owners can only create "
                            "properties for themselves."
                        )
                    }
                )

            attrs["_is_admin"] = False
            attrs["_is_owner"] = True

            return attrs

        # Administrators can create properties for registered owners
        # through an active support session or for external landlords.
        if is_admin:
            support_session_id = attrs.get(
                "support_session_id"
            )

            selected_sources = sum(
                [
                    bool(owner_user_id),
                    bool(external_landlord_id),
                    bool(creating_new_external),
                ]
            )

            if selected_sources != 1:
                raise serializers.ValidationError(
                    (
                        "Admin must choose exactly one owner source: "
                        "owner_user_id, external_landlord_id, or "
                        "new external landlord details."
                    )
                )

            if owner_user_id:
                from support.models import AdminSupportSession

                owner = self._validate_registered_owner(
                    owner_user_id
                )

                if not support_session_id:
                    raise serializers.ValidationError(
                        {
                            "support_session_id": (
                                "Support session is required "
                                "for admin-assisted creation."
                            )
                        }
                    )

                try:
                    session = AdminSupportSession.objects.get(
                        id=support_session_id,
                        admin=user,
                        owner=owner,
                        status=(
                            AdminSupportSession.STATUS_ACTIVE
                        ),
                    )
                except AdminSupportSession.DoesNotExist:
                    raise serializers.ValidationError(
                        {
                            "support_session_id": (
                                "Invalid or inactive "
                                "support session."
                            )
                        }
                    )

                if (
                    not session.expires_at
                    or session.expires_at <= timezone.now()
                ):
                    session.mark_expired()

                    raise serializers.ValidationError(
                        {
                            "support_session_id": (
                                "This support session "
                                "has expired."
                            )
                        }
                    )

                attrs["_resolved_owner"] = owner
                attrs["_support_session"] = session

            if external_landlord_id:
                attrs["_resolved_external_landlord"] = (
                    self._validate_existing_external_landlord(
                        external_landlord_id
                    )
                )

            if creating_new_external:
                self._validate_new_external_landlord_data(
                    external
                )

                attrs["_new_external_data"] = external

            attrs["_is_admin"] = True
            attrs["_is_owner"] = False

            return attrs

        raise serializers.ValidationError(
            "You are not allowed to create a property."
        )

    # ------------------------------------------------------------------ #
    #  Property creation                                                #
    # ------------------------------------------------------------------ #

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        is_admin = validated_data.pop(
            "_is_admin",
            False,
        )

        validated_data.pop("_is_owner", None)

        # Removes serializer-only owner-selection fields before
        # constructing the actual Property model.
        validated_data.pop("owner_user_id", None)
        validated_data.pop("external_landlord_id", None)
        validated_data.pop("external_full_name", None)
        validated_data.pop("external_phone", None)
        validated_data.pop("external_email", None)
        validated_data.pop(
            "external_business_name",
            None,
        )
        validated_data.pop(
            "external_document_type",
            None,
        )
        validated_data.pop(
            "external_id_number",
            None,
        )
        validated_data.pop(
            "external_document_file",
            None,
        )
        validated_data.pop(
            "support_session_id",
            None,
        )

        resolved_owner = validated_data.pop(
            "_resolved_owner",
            None,
        )

        resolved_external_landlord = validated_data.pop(
            "_resolved_external_landlord",
            None,
        )

        new_external_data = validated_data.pop(
            "_new_external_data",
            None,
        )

        support_session = validated_data.pop(
            "_support_session",
            None,
        )

        is_owner_role = (
            not is_admin
            and bool(
                user
                and user.is_authenticated
                and getattr(user, "role", None)
                == "owner"
            )
        )

        # A multi-unit apartment should not appear rentable until at
        # least one ApartmentUnit has actually been added.
        if (
            validated_data.get("category") == "apartment"
            and validated_data.get(
                "apartment_listing_type"
            )
            == "multi_unit"
        ):
            validated_data["is_available"] = False

        if is_owner_role:
            validated_data["owner"] = user
            validated_data["external_landlord"] = None

        elif is_admin:
            if resolved_owner:
                validated_data["owner"] = resolved_owner
                validated_data["external_landlord"] = None
                validated_data["created_by_admin"] = user
                validated_data["support_session"] = (
                    support_session
                )

            elif resolved_external_landlord:
                validated_data["owner"] = None
                validated_data["external_landlord"] = (
                    resolved_external_landlord
                )

            else:
                ext = new_external_data

                with transaction.atomic():
                    external_landlord_obj = (
                        ExternalLandlord.objects.create(
                            full_name=ext["full_name"],
                            phone=ext["phone"],
                            email=ext["email"],
                            business_name=ext[
                                "business_name"
                            ],
                            document_type=ext[
                                "document_type"
                            ],
                            id_number=ext["id_number"],
                            document_file=ext[
                                "document_file"
                            ],
                            created_by=user,
                        )
                    )

                    validated_data["owner"] = None
                    validated_data[
                        "external_landlord"
                    ] = external_landlord_obj

                    property_obj = Property(
                        **validated_data
                    )

                    property_obj.full_clean()
                    property_obj.save()

                    self._save_property_images(
                        request,
                        property_obj,
                    )

                self._after_property_created(
                    property_obj,
                    user,
                )

                return property_obj

        with transaction.atomic():
            property_obj = Property(
                **validated_data
            )

            property_obj.full_clean()
            property_obj.save()

            self._save_property_images(
                request,
                property_obj,
            )

        self._after_property_created(
            property_obj,
            user,
        )

        return property_obj

    # ------------------------------------------------------------------ #
    #  Property creation side effects                                   #
    # ------------------------------------------------------------------ #

    def _after_property_created(
        self,
        property_obj,
        user,
    ):
        """
        Preserves the existing admin notification, duplicate-property
        scan and system logging behaviour after a successful creation.
        """
        property_id = property_obj.id
        property_name = property_obj.property_name
        owner_name = (
            property_obj.owner_name
            or "Unknown"
        )

        transaction.on_commit(
            lambda: _notify_admins(
                message=(
                    "New property submitted for approval: "
                    f"'{property_name}' by {owner_name}."
                ),
                notification_type="property_submitted",
                property_id=property_id,
            )
        )

        transaction.on_commit(
            lambda: check_duplicate_property(
                Property.objects.get(
                    pk=property_id
                )
            )
        )

        try:
            owner_source = (
                "registered"
                if property_obj.owner
                else "external"
            )

            log_property_event(
                message=(
                    "Property created: "
                    f"{property_obj.property_name}"
                ),
                status="success",
                user=user,
                detail=(
                    f"Category: {property_obj.category}, "
                    f"Type: {property_obj.property_type}, "
                    f"City: {property_obj.city}, "
                    f"Owner source: {owner_source}"
                ),
                property_id=property_obj.id,
            )

        except Exception:
            pass

    # ------------------------------------------------------------------ #
    #  Property image saving                                            #
    # ------------------------------------------------------------------ #

    def _save_property_images(
        self,
        request,
        property_obj,
    ):
        """
        Compresses every uploaded property image before storing it.
        """
        if not request:
            return

        for image in request.FILES.getlist(
            "property_images"
        ):
            # Reduces uploaded image size before permanent storage.
            compressed_image = compress_property_image(
                image
            )

            # Duplicate detection uses the compressed file hash.
            image_hash = _generate_file_hash(
                compressed_image
            )

            PropertyImage.objects.create(
                property=property_obj,
                image=compressed_image,
                image_hash=image_hash,
            )

    # ------------------------------------------------------------------ #
    #  Property update                                                  #
    # ------------------------------------------------------------------ #

    def update(self, instance, validated_data):
        """
        Updates ordinary property information while protecting
        ownership, approval and security-controlled fields.
        """

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
            "_support_session",
            "_resolved_external_landlord",
            "_new_external_data",
        ]

        for field in protected_fields:
            if field in validated_data:
                logger.warning(
                    (
                        "PropertySerializer.update() received "
                        "protected field '%s' for property "
                        "pk=%s — ignoring."
                    ),
                    field,
                    instance.pk,
                )

                validated_data.pop(field)

        request = self.context.get("request")

        new_images = (
            request.FILES.getlist(
                "property_images"
            )
            if request
            else []
        )

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(
                    instance,
                    attr,
                    value,
                )

            instance.full_clean()
            instance.save()

            # A multi-unit apartment's public availability must be
            # derived from its child units rather than client input.
            if (
                instance.category == "apartment"
                and instance.apartment_listing_type
                == "multi_unit"
            ):
                instance.sync_availability()

            delete_urls = []

            if request:
                data = request.data

                if hasattr(data, "getlist"):
                    # multipart/form-data can contain repeated values.
                    delete_urls = data.getlist(
                        "delete_images"
                    )

                else:
                    delete_urls = data.get(
                        "delete_images",
                        [],
                    )

                    if isinstance(
                        delete_urls,
                        str,
                    ):
                        delete_urls = [
                            delete_urls
                        ]

            # Deletes only property images explicitly selected
            # for removal by the frontend.
            if delete_urls:
                for img in instance.images.all():
                    full_url = (
                        request.build_absolute_uri(
                            img.image.url
                        )
                        if request
                        else img.image.url
                    )

                    if (
                        full_url in delete_urls
                        or img.image.url
                        in delete_urls
                    ):
                        img.delete()

            # New images are appended without deleting unchanged images.
            if new_images:
                self._save_property_images(
                    request,
                    instance,
                )

        try:
            log_property_event(
                message=(
                    "Property updated: "
                    f"{instance.property_name}"
                ),
                status="info",
                user=(
                    request.user
                    if request
                    else None
                ),
                detail=(
                    f"Property ID: {instance.id}, "
                    f"Category: {instance.category}, "
                    f"Type: {instance.property_type}, "
                    f"City: {instance.city}"
                ),
                property_id=instance.id,
            )

        except Exception:
            pass

        return instance


# ------------------------------------------------------------------ #
#  Favorite serializer                                               #
# ------------------------------------------------------------------ #


class FavoriteSerializer(serializers.ModelSerializer):
    """
    Preserves the existing property-favourite workflow.
    """

    property = PropertySerializer(
        read_only=True
    )

    property_id = serializers.IntegerField(
        write_only=True
    )

    class Meta:
        model = Favorite
        fields = [
            "id",
            "property",
            "property_id",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "property",
            "created_at",
        ]

    def validate_property_id(self, value):
        try:
            property_obj = Property.objects.get(
                id=value,
                approval_status="approved",
            )
        except Property.DoesNotExist:
            raise serializers.ValidationError(
                "Property not found or not approved."
            )

        self._validated_property = property_obj

        return value

    def create(self, validated_data):
        user = self.context["request"].user

        validated_data.pop("property_id")

        property_obj = getattr(
            self,
            "_validated_property",
            None,
        )

        if property_obj is None:
            raise serializers.ValidationError(
                "Property could not be resolved."
            )

        favorite, _ = Favorite.objects.get_or_create(
            user=user,
            property=property_obj,
        )

        return favorite