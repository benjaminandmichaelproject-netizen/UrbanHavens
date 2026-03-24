from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class ExternalLandlord(models.Model):
    full_name     = models.CharField(max_length=255)
    phone         = models.CharField(max_length=20, blank=True, null=True)
    email         = models.EmailField(blank=True, null=True)
    business_name = models.CharField(max_length=255, blank=True, null=True)
    document_type = models.CharField(max_length=50)
    id_number     = models.CharField(max_length=100, unique=True)

    # FIX: added blank=True, null=True to align with the serializer which
    # accepts allow_null=True for this field. Without this, a null value
    # that passes serializer validation will crash at the DB layer instead
    # of being caught with a clean error message.
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

    # FIX: changed on_delete from CASCADE to PROTECT on both FK fields.
    # CASCADE was silently deleting all properties when a landlord or user
    # account was removed — almost certainly unintended for a property
    # listing platform. PROTECT forces an explicit decision: you must
    # reassign or manually delete the properties before the owner can be
    # removed, which prevents accidental data loss.
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

    is_available    = models.BooleanField(default=True)
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
    security_flag_type    = models.CharField(
        max_length=100,
        choices=SECURITY_FLAG_TYPE_CHOICES,
        blank=True, null=True,
    )
    security_flag_reason  = models.TextField(blank=True, null=True)
    security_flagged_at   = models.DateTimeField(blank=True, null=True)
    security_under_review = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # FIX: kept the DB-level CheckConstraint as the authoritative
            # last line of defence. clean() below provides the Python-level
            # error message for API clients. The two are intentionally aligned
            # so neither can drift independently without breaking tests.
            models.CheckConstraint(
                name="property_exactly_one_owner_source",
                condition=(
                    (Q(owner__isnull=False) & Q(external_landlord__isnull=True))
                    | (Q(owner__isnull=True) & Q(external_landlord__isnull=False))
                ),
            ),
        ]

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
        # Enforce business rules that must always hold regardless of caller.
        # Keep this lightweight — no DB queries, no full_clean().
        if self.approval_status != "approved":
            self.is_featured = False
            self.approved_by = None
            self.approved_at = None

        # FIX: removed full_clean() from here. Calling full_clean() inside
        # save() causes two problems:
        #   1. On CREATE, validate_constraints() has no PK to exclude, which
        #      can produce false-positive uniqueness errors.
        #   2. The constraint check runs outside the save() transaction,
        #      creating a TOCTOU window.
        # Instead, callers that need model-level validation (the serializer,
        # management commands, tests) should call full_clean() explicitly
        # before save(), inside an atomic block:
        #
        #   with transaction.atomic():
        #       instance.full_clean()
        #       instance.save()

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


class PropertyImage(models.Model):
    property   = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="images")
    image      = models.ImageField(upload_to="property_images/")
    image_hash = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.property.property_name}"


class PropertyDuplicateMatch(models.Model):
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
    match_score  = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["property", "matched_property"],
                name="unique_property_duplicate_match",
            ),
            # FIX: use _id suffix (the actual DB column names) instead of
            # models.F("matched_property"). Using the FK field name directly
            # inside Q() for a CheckConstraint generates ambiguous SQL on
            # MySQL/MariaDB — Django may render it as a literal string
            # comparison rather than a column-to-column comparison.
            # _id columns are unambiguous on all supported backends.
            models.CheckConstraint(
                condition=~Q(property_id=models.F("matched_property_id")),
                name="property_duplicate_match_not_self",
            ),
        ]

    def __str__(self):
        return f"{self.property_id} matched with {self.matched_property_id}"


class Favorite(models.Model):
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
            models.UniqueConstraint(
                fields=["user", "property"],
                name="unique_user_property_favorite",
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} -> {self.property.property_name}"