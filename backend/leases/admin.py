from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import TenantLease


@admin.register(TenantLease)
class TenantLeaseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tenant",
        "property",
        "status",
        "lease_start_date",
        "lease_end_date",
    )
    list_filter = ("status",)
    search_fields = ("tenant__username", "property__property_name")