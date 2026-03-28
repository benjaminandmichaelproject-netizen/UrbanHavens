from django.contrib import admin

# Register your mofrom django.contrib import admin
from .models import AdminSupportSession


@admin.register(AdminSupportSession)
class AdminSupportSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner",
        "admin",
        "status",
        "invited_at",
        "started_at",
        "expires_at",
        "ended_at",
    )
    list_filter = ("status", "invited_at", "started_at")
    search_fields = ("owner__username", "owner__email", "admin__username", "admin__email", "reason")
