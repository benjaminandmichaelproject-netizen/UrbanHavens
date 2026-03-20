from django.contrib import admin
from django.utils.html import format_html
from .models import Property, PropertyImage, ExternalLandlord


class PropertyImageInline(admin.TabularInline):
    model = PropertyImage
    extra = 0
    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="100" style="border-radius:6px;" />',
                obj.image.url
            )
        return "No Image"

    image_preview.short_description = "Preview"


@admin.register(ExternalLandlord)
class ExternalLandlordAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "phone",
        "email",
        "document_type",
        "id_number",
        "is_verified",
        "created_by",
        "created_at",
    )
    list_filter = ("is_verified", "document_type", "created_at")
    search_fields = ("full_name", "phone", "email", "id_number", "business_name")
    readonly_fields = ("created_at", "updated_at")

    def has_delete_permission(self, request, obj=None):
        # Prevent accidental deletion of landlords tied to properties
        if obj and obj.properties.exists():
            return False
        return super().has_delete_permission(request, obj)


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property_name",
        "category",
        "price",
        "city",
        "owner",
        "external_landlord",
        "is_available",
    )
    list_filter = ("category", "city", "region", "is_available")
    search_fields = ("property_name", "city", "region", "description")
    inlines = [PropertyImageInline]


@admin.register(PropertyImage)
class PropertyImageAdmin(admin.ModelAdmin):
    list_display = ("id", "property", "image", "image_preview")
    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="120" style="border-radius:6px;" />',
                obj.image.url
            )
        return "No Image"

    image_preview.short_description = "Preview"