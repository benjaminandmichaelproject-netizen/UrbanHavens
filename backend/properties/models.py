from django.db import models
from django.conf import settings
from django.utils import timezone

class Property(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # Links to your custom User model
        on_delete=models.CASCADE,
        related_name="properties"
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)  # ✅ automatic creation time

    def __str__(self):
        return f"{self.title} - {self.owner.username}"