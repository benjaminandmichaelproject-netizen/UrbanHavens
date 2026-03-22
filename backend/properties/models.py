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
    document_file = models.FileField(upload_to="landlord_documents/")
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

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="properties",
        null=True, blank=True,
    )
    external_landlord = models.ForeignKey(
        ExternalLandlord,
        on_delete=models.CASCADE,
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

    # ── bathrooms is optional for hostels ────────────────────────────
    bathrooms = models.PositiveIntegerField(default=0)

    price       = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField()
    amenities   = models.JSONField(default=list, blank=True)

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
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

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
            self.is_featured  = False
            self.approved_by  = None
            self.approved_at  = None
        self.full_clean()
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
    property    = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="images")
    image       = models.ImageField(upload_to="property_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.property.property_name}"