from django.db import models

class Property(models.Model):
    title = models.CharField(max_length=200)
    image = models.ImageField(upload_to='properties/')
    beds = models.IntegerField()
    bath = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title