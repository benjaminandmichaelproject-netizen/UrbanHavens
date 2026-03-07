from django.db import models

class Rental(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    location = models.CharField(max_length=200)

    beds = models.IntegerField()
    baths = models.IntegerField()
    sqft = models.IntegerField()

    image = models.URLField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title