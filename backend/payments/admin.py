from django.contrib import admin

from .models import OwnerPaymentAccount, Payment


@admin.register(OwnerPaymentAccount)
class OwnerPaymentAccountAdmin(admin.ModelAdmin):
    list_display = (
        "owner",
        "account_name",
        "provider",
        "is_verified",
        "is_active",
        "created_at",
    )

    list_filter = (
        "provider",
        "is_verified",
        "is_active",
    )

    search_fields = (
        "owner__email",
        "owner__username",
        "account_name",
        "phone_number",
    )

    readonly_fields = (
        "last_four_digits",
        "created_at",
        "updated_at",
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "tenant",
        "landlord",
        "property",
        "payment_method",
        "duration_months",
        "amount",
        "status",
        "verified_at",
        "created_at",
    )

    list_filter = (
        "status",
        "payment_method",
        "payment_type",
        "created_at",
    )

    search_fields = (
        "reference",
        "tenant__email",
        "tenant__username",
        "landlord__email",
        "landlord__username",
        "property__property_name",
    )

    readonly_fields = (
        "reference",
        "paystack_access_code",
        "paystack_authorization_url",
        "paystack_response",
        "verified_at",
        "created_at",
        "updated_at",
    )

    ordering = ("-created_at",)