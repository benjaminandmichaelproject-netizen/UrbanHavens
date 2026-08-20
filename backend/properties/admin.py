from django.contrib import admin
from django.utils.html import format_html

from .models import (
    ApartmentUnit,
    ExternalLandlord,
    Property,
    PropertyDuplicateMatch,
    PropertyImage,
)


class PropertyImageInline(admin.TabularInline):
    model = PropertyImage
    extra = 0
    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="100" style="border-radius:6px;" />',
                obj.image.url,
            )

        return "No Image"

    image_preview.short_description = "Preview"


# Allows multi-unit apartment units to be managed directly
# from the parent Property page in Django Admin.
class ApartmentUnitInline(admin.TabularInline):
    model = ApartmentUnit
    extra = 0
    show_change_link = True

    fields = (
        "unit_number",
        "bedrooms",
        "bathrooms",
        "floor",
        "price",
        "is_furnished",
        "status",
    )


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

    list_filter = (
        "is_verified",
        "document_type",
        "created_at",
    )

    search_fields = (
        "full_name",
        "phone",
        "email",
        "id_number",
        "business_name",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    def has_delete_permission(self, request, obj=None):
        # Prevents accidental deletion of landlords
        # that are still connected to properties.
        if obj and obj.properties.exists():
            return False

        return super().has_delete_permission(request, obj)


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property_name",
        "category",
        "apartment_listing_type",
        "price",
        "city",
        "owner",
        "external_landlord",
        "is_available",
        "security_flagged",
        "security_flag_type",
        "security_under_review",
        "reported_count",
        "report_flag_status",
        "report_flagged",
    )

    list_filter = (
        "category",
        "apartment_listing_type",
        "city",
        "region",
        "is_available",
        "security_flagged",
        "security_flag_type",
        "security_under_review",
    )

    search_fields = (
        "property_name",
        "city",
        "region",
        "description",
        "security_flag_reason",
    )

    readonly_fields = (
        "security_flagged",
        "security_flag_type",
        "security_flag_reason",
        "security_flagged_at",
        "security_under_review",
    )

    # Property images remain available for every property.
    inlines = [PropertyImageInline]

    def get_inlines(self, request, obj):
        """
        Shows apartment units only when editing an existing
        multi-unit apartment.
        """
        inlines = [PropertyImageInline]

        if (
            obj
            and obj.category == "apartment"
            and obj.apartment_listing_type == "multi_unit"
        ):
            inlines.append(ApartmentUnitInline)

        return inlines


@admin.register(PropertyImage)
class PropertyImageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "image",
        "image_preview",
    )

    readonly_fields = ("image_preview",)

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="120" style="border-radius:6px;" />',
                obj.image.url,
            )

        return "No Image"

    image_preview.short_description = "Preview"


# Also provides a dedicated Apartment Units section in Django Admin
# for searching and managing units independently.
@admin.register(ApartmentUnit)
class ApartmentUnitAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "unit_number",
        "bedrooms",
        "bathrooms",
        "floor",
        "price",
        "is_furnished",
        "status",
        "updated_at",
    )

    list_filter = (
        "status",
        "is_furnished",
        "bedrooms",
        "bathrooms",
    )

    search_fields = (
        "unit_number",
        "property__property_name",
        "property__city",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(PropertyDuplicateMatch)
class PropertyDuplicateMatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "matched_property",
        "match_score",
        "created_at",
    )

    list_filter = ("created_at",)

    search_fields = (
        "property__property_name",
        "matched_property__property_name",
        "match_reason",
    )

    readonly_fields = (
        "property",
        "matched_property",
        "match_reason",
        "match_score",
        "created_at",
    )