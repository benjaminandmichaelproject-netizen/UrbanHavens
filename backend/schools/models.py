from django.db import models


class School(models.Model):
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

    name = models.CharField(max_length=255, unique=True)
    city = models.CharField(max_length=100)
    region = models.CharField(max_length=50, choices=REGION_CHOICES)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.city})"