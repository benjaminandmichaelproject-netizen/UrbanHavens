from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class ExternalLandlord(models.Model):
    # Stores identification and contact details for external landlords.
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    business_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
    )
    document_type = models.CharField(max_length=50)
    id_number = models.CharField(max_length=100, unique=True)
    document_file = models.FileField(
        upload_to="landlord_documents/",
        blank=True,
        null=True,
    )
    is_verified = models.BooleanField(default=False)

    # Tracks the administrator who created the external landlord.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_external_landlords",
    )

    # Records when the external landlord was created and updated.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Returns the landlord's readable name.
    def __str__(self):
        return self.full_name


class Property(models.Model):
    # Defines the valid property approval states.
    APPROVAL_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    # Defines the supported property security flag types.
    SECURITY_FLAG_TYPE_CHOICES = [
        ("duplicate_property", "Duplicate Property"),
    ]

    # Defines whether an apartment is rented as one unit
    # or contains several separately rentable apartment units.
    APARTMENT_LISTING_TYPE_CHOICES = [
        ("single", "Single Apartment"),
        ("multi_unit", "Multiple Apartment Units"),
    ]

    # Defines Ghana's supported regions.
    REGION_CHOICES = [
        ("ahafo", "Ahafo"),
        ("ashanti", "Ashanti"),
        ("bono", "Bono"),
        ("bono_east", "Bono East"),
        ("central", "Central"),
        ("eastern", "Eastern"),
        ("greater_accra", "Greater Accra"),
        ("north_east", "North East"),
        ("northern", "Northern"),
        ("oti", "Oti"),
        ("savannah", "Savannah"),
        ("upper_east", "Upper East"),
        ("upper_west", "Upper West"),
        ("volta", "Volta"),
        ("western", "Western"),
        ("western_north", "Western North"),
    ]

    # Links the property to either a registered or external owner.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="properties",
        null=True,
        blank=True,
    )
    external_landlord = models.ForeignKey(
        ExternalLandlord,
        on_delete=models.PROTECT,
        related_name="properties",
        null=True,
        blank=True,
    )

    # Stores the property's main listing details.
    property_name = models.CharField(max_length=255)

    # Defines the main type of property being listed.
    category = models.CharField(
        max_length=50,
        choices=[
            ("hostel", "Hostel"),
            ("house_rent", "House for Rent"),
            ("apartment", "Apartment"),
        ],
    )

    # Used only when the selected property category is Apartment.
    # Existing hostel and house records remain unaffected because
    # this field is optional.
    apartment_listing_type = models.CharField(
        max_length=20,
        choices=APARTMENT_LISTING_TYPE_CHOICES,
        blank=True,
        null=True,
    )

    property_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )
    # Multi-unit apartment parents store these values on ApartmentUnit.
    # Other property categories still require them through model/serializer validation.
    bedrooms = models.PositiveIntegerField(null=True, blank=True)
    bathrooms = models.PositiveIntegerField(null=True, blank=True)
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    description = models.TextField()
    amenities = models.JSONField(default=list, blank=True)
    allowed_rental_months = models.JSONField(
        default=list,
        blank=True,
    )

    # Stores the property's location details.
    region = models.CharField(
        max_length=50,
        choices=REGION_CHOICES,
    )
    city = models.CharField(max_length=100)
    school = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)

    # For houses and single apartments, this represents the
    # availability of the whole property.
    # For hostels and multi-unit apartments, it is synchronized
    # from their child rooms or apartment units.
    is_available = models.BooleanField(default=True)

    # Tracks property approval and featuring details.
    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default="pending",
        db_index=True,
    )
    is_featured = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_properties",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Stores duplicate-property security review information.
    security_flagged = models.BooleanField(default=False)
    security_flag_type = models.CharField(
        max_length=100,
        choices=SECURITY_FLAG_TYPE_CHOICES,
        blank=True,
        null=True,
    )
    security_flag_reason = models.TextField(
        blank=True,
        null=True,
    )
    security_flagged_at = models.DateTimeField(
        blank=True,
        null=True,
    )
    security_under_review = models.BooleanField(default=False)

    # Stores report-based moderation information.
    report_flag_status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("flagged", "Flagged"),
            ("hidden", "Hidden"),
            ("reviewing", "Reviewing"),
            ("resolved", "Resolved"),
        ],
        default="active",
    )
    report_flagged = models.BooleanField(default=False)
    report_flagged_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    report_flag_reason_summary = models.TextField(
        blank=True,
        default="",
    )
    reported_count = models.PositiveIntegerField(default=0)

    # Tracks administrative property creation and support sessions.
    created_by_admin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_created_properties",
    )
    support_session = models.ForeignKey(
        "support.AdminSupportSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_properties",
    )

    # Records when the property was created and updated.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Ensures every property has exactly one valid owner source.
        constraints = [
            models.CheckConstraint(
                name="property_exactly_one_owner_source",
                condition=(
                    (
                        Q(owner__isnull=False)
                        & Q(external_landlord__isnull=True)
                    )
                    | (
                        Q(owner__isnull=True)
                        & Q(external_landlord__isnull=False)
                    )
                ),
            ),
        ]

    # Recalculates availability for property types that contain
    # separately rentable child units.
    def sync_availability(self):
        # A hostel remains available while at least one room
        # still has an available space.
        if self.category == "hostel":
            has_space = self.rooms.filter(
                is_available=True
            ).exists()

            Property.objects.filter(pk=self.pk).update(
                is_available=has_space
            )

            self.is_available = has_space

        # A multi-unit apartment remains available while at least
        # one individual apartment unit is available.
        elif (
            self.category == "apartment"
            and self.apartment_listing_type == "multi_unit"
        ):
            has_available_unit = self.apartment_units.filter(
                status="available"
            ).exists()

            Property.objects.filter(pk=self.pk).update(
                is_available=has_available_unit
            )

            self.is_available = has_available_unit

    # Validates ownership, featured-property rules,
    # and apartment-specific configuration.
    def clean(self):
        super().clean()

        has_registered_owner = self.owner_id is not None
        has_external_landlord = (
            self.external_landlord_id is not None
        )

        # A property must belong to either a registered owner
        # or an external landlord, but never both.
        if has_registered_owner == has_external_landlord:
            raise ValidationError(
                {
                    "owner": (
                        "Exactly one owner source must be set."
                    ),
                    "external_landlord": (
                        "Exactly one owner source must be set."
                    ),
                }
            )

        # Only approved properties can appear as featured properties.
        if (
            self.is_featured
            and self.approval_status != "approved"
        ):
            raise ValidationError(
                {
                    "is_featured": (
                        "Only approved properties can be featured."
                    )
                }
            )

        # Every apartment must state whether it represents a
        # single apartment or multiple separately rentable units.
        if (
            self.category == "apartment"
            and not self.apartment_listing_type
        ):
            raise ValidationError(
                {
                    "apartment_listing_type": (
                        "Choose whether this is a single apartment "
                        "or a multi-unit apartment property."
                    )
                }
            )

        # Prevents house and hostel records from accidentally
        # carrying apartment-only configuration.
        if (
            self.category != "apartment"
            and self.apartment_listing_type
        ):
            raise ValidationError(
                {
                    "apartment_listing_type": (
                        "Apartment listing type can only be used "
                        "for apartment properties."
                    )
                }
            )

        # Multi-unit apartment parents intentionally leave these fields empty
        # because bedrooms, bathrooms, and price belong to ApartmentUnit.
        is_multi_unit_apartment = (
            self.category == "apartment"
            and self.apartment_listing_type == "multi_unit"
        )

        # Hostels, houses, and single apartments retain parent-level values.
        if not is_multi_unit_apartment:
            required_field_errors = {}

            if self.bedrooms is None:
                required_field_errors["bedrooms"] = (
                    "Bedrooms are required for this property type."
                )

            if self.bathrooms is None:
                required_field_errors["bathrooms"] = (
                    "Bathrooms are required for this property type."
                )

            if self.price is None:
                required_field_errors["price"] = (
                    "Price is required for this property type."
                )

            if required_field_errors:
                raise ValidationError(required_field_errors)

    # Prevents unapproved properties from remaining featured.
    def save(self, *args, **kwargs):
        if self.approval_status != "approved":
            self.is_featured = False
            self.approved_by = None
            self.approved_at = None

        super().save(*args, **kwargs)

    # Returns the registered or external owner's readable name.
    @property
    def owner_name(self):
        if self.owner:
            full_name = (
                f"{self.owner.first_name} "
                f"{self.owner.last_name}"
            ).strip()

            return full_name or self.owner.username

        if self.external_landlord:
            return self.external_landlord.full_name

        return "No Owner"

    # Returns the registered or external owner's email.
    @property
    def owner_email(self):
        if self.owner:
            return self.owner.email

        if self.external_landlord:
            return self.external_landlord.email

        return None

    # Returns the registered or external owner's phone number.
    @property
    def owner_phone(self):
        if self.owner:
            return getattr(self.owner, "phone", None)

        if self.external_landlord:
            return self.external_landlord.phone

        return None

    # Returns the property's readable name and owner.
    def __str__(self):
        return f"{self.property_name} ({self.owner_name})"


class Room(models.Model):
    # Defines supported hostel room types.
    ROOM_TYPE_CHOICES = [
        ("single", "Single"),
        ("double", "Double"),
        ("mixed", "Mixed"),
    ]

    # Defines supported room gender restrictions.
    GENDER_CHOICES = [
        ("male", "Male only"),
        ("female", "Female only"),
        ("mixed", "Mixed"),
    ]

    # Links the room to its hostel property.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="rooms",
    )

    # Stores the room's identity and access rules.
    room_number = models.CharField(max_length=20)
    room_type = models.CharField(
        max_length=20,
        choices=ROOM_TYPE_CHOICES,
        default="mixed",
    )
    gender_restriction = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        default="mixed",
    )

    # Tracks the room's capacity, occupants, and paid reservations.
    max_capacity = models.PositiveIntegerField(default=1)
    occupied_spaces = models.PositiveIntegerField(default=0)
    reserved_spaces = models.PositiveIntegerField(default=0)

    # Stores an optional room-specific rental price.
    price_override = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    # Indicates whether at least one unreserved space remains.
    is_available = models.BooleanField(default=True)

    # Records when the room was created and updated.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Prevents duplicate room numbers inside the same hostel.
            models.UniqueConstraint(
                fields=["property", "room_number"],
                name="unique_property_room_number",
            ),

            # Limits hostel room capacity to the supported range.
            models.CheckConstraint(
                condition=(
                    Q(max_capacity__gte=1)
                    & Q(max_capacity__lte=6)
                ),
                name="room_max_capacity_between_1_and_6",
            ),

            # Prevents occupied spaces from exceeding room capacity.
            models.CheckConstraint(
                condition=Q(
                    occupied_spaces__lte=F("max_capacity")
                ),
                name="room_occupied_lte_max_capacity",
            ),

            # Prevents reserved spaces from exceeding room capacity.
            models.CheckConstraint(
                condition=Q(
                    reserved_spaces__lte=F("max_capacity")
                ),
                name="room_reserved_lte_max_capacity",
            ),

            # Prevents occupied and reserved spaces together from
            # exceeding the room's maximum capacity.
            models.CheckConstraint(
                condition=Q(
                    occupied_spaces__lte=(
                        F("max_capacity")
                        - F("reserved_spaces")
                    )
                ),
                name="room_used_spaces_lte_max_capacity",
            ),
        ]

    # Returns the number of spaces that remain bookable.
    def available_spaces(self):
        return (
            self.max_capacity
            - self.occupied_spaces
            - self.reserved_spaces
        )

    # Ensures rooms belong only to hostel properties and
    # prevents impossible capacity values.
    def clean(self):
        super().clean()

        if (
            self.property_id
            and self.property.category != "hostel"
        ):
            raise ValidationError(
                {
                    "property": (
                        "Rooms can only be added to hostel "
                        "properties."
                    )
                }
            )

        if self.occupied_spaces > self.max_capacity:
            raise ValidationError(
                {
                    "occupied_spaces": (
                        "Occupied spaces cannot exceed room "
                        "capacity."
                    )
                }
            )

        if self.reserved_spaces > self.max_capacity:
            raise ValidationError(
                {
                    "reserved_spaces": (
                        "Reserved spaces cannot exceed room "
                        "capacity."
                    )
                }
            )

        if (
            self.occupied_spaces + self.reserved_spaces
            > self.max_capacity
        ):
            raise ValidationError(
                {
                    "reserved_spaces": (
                        "Occupied and reserved spaces cannot "
                        "exceed room capacity."
                    )
                }
            )

    # Synchronizes room and hostel availability after every save.
    def save(self, *args, **kwargs):
        self.full_clean()

        self.is_available = self.available_spaces() > 0

        super().save(*args, **kwargs)

        if self.property_id:
            self.property.sync_availability()

    # Synchronizes hostel availability after a room is deleted.
    def delete(self, *args, **kwargs):
        property_obj = self.property

        super().delete(*args, **kwargs)

        if property_obj:
            property_obj.sync_availability()

    # Returns the hostel and room number.
    def __str__(self):
        return (
            f"{self.property.property_name} "
            f"- Room {self.room_number}"
        )


class ApartmentUnit(models.Model):
    # Defines the current rental state of one apartment unit.
    # Payment will later move a unit from available to reserved,
    # while lease activation can move it to occupied.
    UNIT_STATUS_CHOICES = [
        ("available", "Available"),
        ("reserved", "Reserved"),
        ("occupied", "Occupied"),
    ]

    # Links this unit to the apartment property/building
    # that contains it.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="apartment_units",
    )

    # Stores the unit identifier displayed to owners and tenants,
    # for example A1, A2, B1, Flat 3 or Apartment 4.
    unit_number = models.CharField(max_length=50)

    # Stores information that can differ between units
    # inside the same apartment property.
    bedrooms = models.PositiveIntegerField(default=1)
    bathrooms = models.PositiveIntegerField(default=1)

    # Allows descriptive floor values such as Ground Floor,
    # First Floor or Floor 3.
    floor = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    # Each apartment unit has its own rental price.
    price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Stores furnishing and unit-specific amenity information.
    is_furnished = models.BooleanField(default=False)
    amenities = models.JSONField(
        default=list,
        blank=True,
    )

    # Tracks whether this exact unit can currently be selected
    # by another tenant.
    status = models.CharField(
        max_length=20,
        choices=UNIT_STATUS_CHOICES,
        default="available",
        db_index=True,
    )

    # Records when the unit was created and last updated.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Prevents duplicate unit numbers within the same
            # apartment property while allowing another building
            # to use the same unit number.
            models.UniqueConstraint(
                fields=["property", "unit_number"],
                name="unique_property_apartment_unit",
            ),
        ]

    # Ensures apartment units cannot accidentally be attached
    # to houses, hostels or single-apartment listings.
    def clean(self):
        super().clean()

        if self.property_id:
            if self.property.category != "apartment":
                raise ValidationError(
                    {
                        "property": (
                            "Apartment units can only be added "
                            "to apartment properties."
                        )
                    }
                )

            if (
                self.property.apartment_listing_type
                != "multi_unit"
            ):
                raise ValidationError(
                    {
                        "property": (
                            "Apartment units can only be added "
                            "to multi-unit apartment properties."
                        )
                    }
                )

    # Validates the unit before saving and then recalculates
    # whether the parent apartment property is still available.
    def save(self, *args, **kwargs):
        self.full_clean()

        super().save(*args, **kwargs)

        if self.property_id:
            self.property.sync_availability()

    # Recalculates the parent property's availability when
    # an apartment unit is removed.
    def delete(self, *args, **kwargs):
        property_obj = self.property

        super().delete(*args, **kwargs)

        if property_obj:
            property_obj.sync_availability()

    # Returns a readable name for administration and debugging.
    def __str__(self):
        return (
            f"{self.property.property_name} "
            f"- Unit {self.unit_number}"
        )


class PropertyImage(models.Model):
    # Stores uploaded images belonging to a property.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ImageField(upload_to="property_images/")
    image_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Returns the image's property name.
    def __str__(self):
        return f"Image for {self.property.property_name}"


class PropertyDuplicateMatch(models.Model):
    # Stores a possible duplicate relationship between two properties.
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="duplicate_matches",
    )
    matched_property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="matched_by_duplicates",
    )
    match_reason = models.TextField()
    match_score = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Displays newest duplicate matches first.
        ordering = ["-created_at"]

        constraints = [
            # Prevents the same duplicate relationship from
            # being stored more than once.
            models.UniqueConstraint(
                fields=["property", "matched_property"],
                name="unique_property_duplicate_match",
            ),

            # Prevents a property from being marked as a
            # duplicate of itself.
            models.CheckConstraint(
                condition=~Q(
                    property_id=F("matched_property_id")
                ),
                name="property_duplicate_match_not_self",
            ),
        ]

    # Returns a readable duplicate-property relationship.
    def __str__(self):
        return (
            f"{self.property_id} matched with "
            f"{self.matched_property_id}"
        )


class Favorite(models.Model):
    # Links one user to one favorited property.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Prevents a user from favoriting the same
            # property more than once.
            models.UniqueConstraint(
                fields=["user", "property"],
                name="unique_user_property_favorite",
            )
        ]

        # Displays the newest favorites first.
        ordering = ["-created_at"]

    # Returns the user and favorited property.
    def __str__(self):
        return (
            f"{self.user.email} -> "
            f"{self.property.property_name}"
        )