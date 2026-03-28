from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, F


class ExternalLandlord(models.Model):
    full_name     = models.CharField(max_length=255)
    phone         = models.CharField(max_length=20, blank=True, null=True)
    email         = models.EmailField(blank=True, null=True)
    business_name = models.CharField(max_length=255, blank=True, null=True)
    document_type = models.CharField(max_length=50)
    id_number     = models.CharField(max_length=100, unique=True)
    document_file = models.FileField(upload_to="landlord_documents/", blank=True, null=True)
    is_verified   = models.BooleanField(default=False)
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_external_landlords",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.full_name


class Property(models.Model):
    APPROVAL_STATUS_CHOICES = [
        ("pending",  "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]
    SECURITY_FLAG_TYPE_CHOICES = [
        ("duplicate_property", "Duplicate Property"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="properties",
        null=True, blank=True,
    )
    external_landlord = models.ForeignKey(
        ExternalLandlord,
        on_delete=models.PROTECT,
        related_name="properties",
        null=True, blank=True,
    )

    property_name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=50,
        choices=[("hostel", "Hostel"), ("house_rent", "House for Rent")],
    )
    property_type = models.CharField(max_length=50, blank=True, null=True)
    bedrooms      = models.PositiveIntegerField()
    bathrooms     = models.PositiveIntegerField(default=0)
    price         = models.DecimalField(max_digits=12, decimal_places=2)
    description   = models.TextField()
    amenities     = models.JSONField(default=list, blank=True)

    region = models.CharField(max_length=100)
    city   = models.CharField(max_length=100)
    school = models.CharField(max_length=100, blank=True, null=True)
    lat    = models.FloatField(blank=True, null=True)
    lng    = models.FloatField(blank=True, null=True)

    # For house_rent: True = nobody renting, False = occupied.
    # For hostel: True = at least one room has space, False = all rooms full.
    # Never set this directly — always call property.sync_availability().
    is_available = models.BooleanField(default=True)

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
        null=True, blank=True,
        related_name="approved_properties",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    security_flagged      = models.BooleanField(default=False)
    security_flag_type    = models.CharField(max_length=100, choices=SECURITY_FLAG_TYPE_CHOICES, blank=True, null=True)
    security_flag_reason  = models.TextField(blank=True, null=True)
    security_flagged_at   = models.DateTimeField(blank=True, null=True)
    security_under_review = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="property_exactly_one_owner_source",
                condition=(
                    (Q(owner__isnull=False) & Q(external_landlord__isnull=True))
                    | (Q(owner__isnull=True) & Q(external_landlord__isnull=False))
                ),
            ),
        ]

    def sync_availability(self):
        """
        Recompute and save is_available based on current room states.
        Call this after any booking confirmation or cancellation.
        For house_rent there are no Room rows — is_available is managed
        directly by the booking service instead.
        """
        if self.category == "hostel":
            has_space = self.rooms.filter(is_available=True).exists()
            Property.objects.filter(pk=self.pk).update(is_available=has_space)
            self.is_available = has_space

    def clean(self):
        super().clean()
        has_registered_owner  = self.owner_id is not None
        has_external_landlord = self.external_landlord_id is not None

        if has_registered_owner == has_external_landlord:
            raise ValidationError({
                "owner":             "Exactly one owner source must be set.",
                "external_landlord": "Exactly one owner source must be set.",
            })

        if self.is_featured and self.approval_status != "approved":
            raise ValidationError({
                "is_featured": "Only approved properties can be featured."
            })

    def save(self, *args, **kwargs):
        if self.approval_status != "approved":
            self.is_featured = False
            self.approved_by = None
            self.approved_at = None
        super().save(*args, **kwargs)

    @property
    def owner_name(self):
        if self.owner:
            full_name = f"{self.owner.first_name} {self.owner.last_name}".strip()
            return full_name or self.owner.username
        if self.external_landlord:
            return self.external_landlord.full_name
        return "No Owner"

    @property
    def owner_email(self):
        if self.owner:
            return self.owner.email
        if self.external_landlord:
            return self.external_landlord.email
        return None

    @property
    def owner_phone(self):
        if self.owner:
            return getattr(self.owner, "phone", None)
        if self.external_landlord:
            return self.external_landlord.phone
        return None

    def __str__(self):
        return f"{self.property_name} ({self.owner_name})"
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







class Room(models.Model):
    ROOM_TYPE_CHOICES = [
        ("single", "Single"),
        ("double", "Double"),
        ("mixed", "Mixed"),
    ]
    GENDER_CHOICES = [
        ("male", "Male only"),
        ("female", "Female only"),
        ("mixed", "Mixed"),
    ]

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="rooms",
    )
    room_number = models.CharField(max_length=20)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES, default="mixed")
    gender_restriction = models.CharField(max_length=10, choices=GENDER_CHOICES, default="mixed")
    max_capacity = models.PositiveIntegerField(default=1)
    occupied_spaces = models.PositiveIntegerField(default=0)
    price_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("property", "room_number")]
        constraints = [
            models.CheckConstraint(
                condition=Q(occupied_spaces__lte=F("max_capacity")),
                name="room_occupied_lte_max_capacity",
            ),
            models.CheckConstraint(
                condition=Q(max_capacity__gte=1) & Q(max_capacity__lte=6),
                name="room_max_capacity_between_1_and_6",
            ),
        ]

    def available_spaces(self):
        return self.max_capacity - self.occupied_spaces

    def clean(self):
        super().clean()
        if self.property_id and self.property.category != "hostel":
            raise ValidationError({
                "property": "Rooms can only be added to hostel properties."
            })
        if self.occupied_spaces > self.max_capacity:
            raise ValidationError({
                "occupied_spaces": "Occupied spaces cannot exceed room capacity."
            })

    def save(self, *args, **kwargs):
        self.is_available = self.occupied_spaces < self.max_capacity
        super().save(*args, **kwargs)
        if self.property_id:
            self.property.sync_availability()

    def delete(self, *args, **kwargs):
        property_obj = self.property
        super().delete(*args, **kwargs)
        if property_obj:
            property_obj.sync_availability()

    def __str__(self):
        return f"{self.property.property_name} - Room {self.room_number}"






class PropertyImage(models.Model):
    property    = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="images")
    image       = models.ImageField(upload_to="property_images/")
    image_hash  = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.property.property_name}"


class PropertyDuplicateMatch(models.Model):
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="duplicate_matches",
    )
    matched_property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="matched_by_duplicates",
    )
    match_reason = models.TextField()
    match_score  = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["property", "matched_property"],
                name="unique_property_duplicate_match",
            ),
            models.CheckConstraint(
                condition=~Q(property_id=F("matched_property_id")),
                name="property_duplicate_match_not_self",
            ),
        ]

    def __str__(self):
        return f"{self.property_id} matched with {self.matched_property_id}"


class Favorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites",
    )
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="favorited_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "property"],
                name="unique_user_property_favorite",
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} -> {self.property.property_name}"
    
    