from django.contrib import admin
from .models import Booking, InspectionMeeting


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "tenant",
        "owner",
        "phone",
        "preferred_date",
        "preferred_time",
        "status",
        "created_at",
    )
    list_filter = ("status", "preferred_date", "created_at")
    search_fields = (
        "property__property_name",
        "tenant__username",
        "tenant__first_name",
        "tenant__last_name",
        "tenant__email",
        "owner__username",
        "owner__first_name",
        "owner__last_name",
        "owner__email",
        "phone",
    )
    ordering = ("-created_at",)


@admin.register(InspectionMeeting)
class InspectionMeetingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "booking",
        "date",
        "time",
        "location",
        "status",
        "created_at",
        "updated_at",
    )
    list_filter = ("status", "date", "created_at")
    search_fields = (
        "booking__property__property_name",
        "booking__tenant__username",
        "booking__tenant__first_name",
        "booking__tenant__last_name",
        "booking__owner__username",
        "booking__owner__first_name",
        "booking__owner__last_name",
        "location",
    )
    ordering = ("-created_at",)