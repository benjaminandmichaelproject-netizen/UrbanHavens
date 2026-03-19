from django.db import models
from django.conf import settings


class Property(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="properties"
    )
    property_name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=50,
        choices=[("hostel", "Hostel"), ("house_rent", "House for Rent")]
    )
    property_type = models.CharField(max_length=50, blank=True, null=True)
    bedrooms = models.PositiveIntegerField()
    bathrooms = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField()
    amenities = models.JSONField(default=list, blank=True)

    region = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    school = models.CharField(max_length=100, blank=True, null=True)
    lat = models.FloatField(blank=True, null=True)
    lng = models.FloatField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.property_name} ({self.owner.username})"


class PropertyImage(models.Model):
    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="images"
    )
    image = models.ImageField(upload_to="property_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.property.property_name}"