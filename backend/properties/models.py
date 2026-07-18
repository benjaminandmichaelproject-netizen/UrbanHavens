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
    category = models.CharField(
        max_length=50,
        choices=[
            ("hostel", "Hostel"),
            ("house_rent", "House for Rent"),
        ],
    )
    property_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )
    bedrooms = models.PositiveIntegerField()
    bathrooms = models.PositiveIntegerField(default=0)
    price = models.DecimalField(max_digits=12, decimal_places=2)
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

    # Tracks house availability or whether any hostel room has space.
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

    # Recalculates hostel availability from current room states.
    def sync_availability(self):
        if self.category == "hostel":
            has_space = self.rooms.filter(
                is_available=True
            ).exists()

            Property.objects.filter(pk=self.pk).update(
                is_available=has_space
            )
            self.is_available = has_space

    # Validates ownership and featured-property rules.
    def clean(self):
        super().clean()

        has_registered_owner = self.owner_id is not None
        has_external_landlord = (
            self.external_landlord_id is not None
        )

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
        # Prevents duplicate room numbers inside the same hostel.
        constraints = [
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

            # Prevents occupied and reserved spaces exceeding capacity.
            models.CheckConstraint(
                condition=Q(
                    occupied_spaces__lte=(
                        F("max_capacity") - F("reserved_spaces")
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

    # Validates hostel ownership and room capacity values.
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

        # Prevents duplicate pairs and self-matching properties.
        constraints = [
            models.UniqueConstraint(
                fields=["property", "matched_property"],
                name="unique_property_duplicate_match",
            ),
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
        # Prevents a user from favoriting the same property twice.
        constraints = [
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