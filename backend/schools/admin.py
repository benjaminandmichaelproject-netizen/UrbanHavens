from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import School


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display  = ("id", "name", "city", "region", "is_active", "created_at")
    list_filter   = ("region", "city", "is_active")
    search_fields = ("name", "city", "region")
    list_editable = ("is_active",)
    ordering      = ("name",)