from django.contrib import admin
from django.utils.html import format_html
from .models import Property, PropertyImage


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


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ("id", "property_name", "category", "price", "city", "owner")
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