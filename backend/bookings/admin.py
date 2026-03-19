from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("id", "property", "name", "email", "phone", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("name", "email", "phone", "property__property_name")