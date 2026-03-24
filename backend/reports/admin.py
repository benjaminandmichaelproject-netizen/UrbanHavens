from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display  = ("id", "subject", "category", "status", "reported_by", "created_at")
    list_filter   = ("status", "category", "created_at")
    search_fields = ("subject", "description", "reported_by__username", "contact_email")
    readonly_fields = ("reported_by", "created_at", "updated_at")
    ordering      = ("-created_at",)

    fieldsets = (
        ("Report Info", {
            "fields": ("reported_by", "category", "subject", "description", "contact_email")
        }),
        ("What Was Reported", {
            "fields": ("reported_property", "reported_user", "reported_booking")
        }),
        ("Admin", {
            "fields": ("status", "admin_notes", "resolved_at")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )