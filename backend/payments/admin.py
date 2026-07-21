from django.contrib import admin, messages
from rest_framework.test import (
    APIRequestFactory,
    force_authenticate,
)

from .models import OwnerPaymentAccount, Payment
from .views import VerifyPaymentView


@admin.action(
    description="Retry Paystack verification for selected payments"
)
def retry_paystack_verification(
    modeladmin,
    request,
    queryset,
):
    """
    Safely re-runs the normal Paystack verification process.

    This action does not blindly mark a payment as successful.
    It contacts Paystack using the stored reference and executes
    the same verification workflow used by the frontend.
    """
    request_factory = APIRequestFactory()

    verified_count = 0
    already_verified_count = 0
    skipped_count = 0
    failed_results = []

    payments = queryset.select_related(
        "tenant",
        "booking",
        "property",
    )

    for payment in payments:
        # Only Paystack payments can use Paystack verification.
        if payment.payment_method != "paystack":
            skipped_count += 1
            continue

        # Avoids unnecessary processing for completed payments.
        if payment.status == "success":
            already_verified_count += 1
            continue

        if not payment.tenant_id:
            failed_results.append(
                f"Payment #{payment.id}: tenant account is missing."
            )
            continue

        # Creates an internal authenticated request as the tenant.
        internal_request = request_factory.get(
            f"/api/payments/verify/{payment.reference}/"
        )

        force_authenticate(
            internal_request,
            user=payment.tenant,
        )

        try:
            response = VerifyPaymentView.as_view()(
                internal_request,
                reference=str(payment.reference),
            )
        except Exception as exc:
            failed_results.append(
                f"Payment #{payment.id}: {exc}"
            )
            continue

        if 200 <= response.status_code < 300:
            verified_count += 1
            continue

        response_data = getattr(
            response,
            "data",
            {},
        ) or {}

        if isinstance(response_data, dict):
            error_message = (
                response_data.get("detail")
                or response_data.get("error")
                or "Verification failed."
            )
        else:
            error_message = str(response_data)

        failed_results.append(
            f"Payment #{payment.id}: {error_message}"
        )

    if verified_count:
        messages.success(
            request,
            (
                f"{verified_count} payment"
                f"{'' if verified_count == 1 else 's'} "
                "verified successfully."
            ),
        )

    if already_verified_count:
        messages.info(
            request,
            (
                f"{already_verified_count} payment"
                f"{'' if already_verified_count == 1 else 's'} "
                "already verified."
            ),
        )

    if skipped_count:
        messages.warning(
            request,
            (
                f"{skipped_count} non-Paystack payment"
                f"{'' if skipped_count == 1 else 's'} skipped."
            ),
        )

    if failed_results:
        messages.error(
            request,
            " | ".join(failed_results),
        )


@admin.register(OwnerPaymentAccount)
class OwnerPaymentAccountAdmin(admin.ModelAdmin):
    list_display = (
        "owner",
        "account_name",
        "provider",
        "masked_phone_number",
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
        "paystack_subaccount_code",
    )

    readonly_fields = (
        "last_four_digits",
        "paystack_subaccount_code",
        "created_at",
        "updated_at",
    )

    ordering = (
        "-created_at",
    )

    # Shows only the final four digits in the admin list.
    @admin.display(description="Phone number")
    def masked_phone_number(self, obj):
        if not obj.phone_number:
            return "—"

        return f"******{obj.phone_number[-4:]}"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    actions = (
        retry_paystack_verification,
    )

    list_display = (
        "reference",
        "tenant",
        "landlord",
        "property",
        "payment_method",
        "duration_months",
        "amount",
        "status",
        "payment_completion_status",
        "settlement_status",
        "verified_at",
        "created_at",
    )

    list_filter = (
        "status",
        "payment_method",
        "payment_type",
        "payment_completion_status",
        "settlement_status",
        "created_at",
    )

    search_fields = (
        "reference",
        "receipt_number",
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
        "expected_amount",
        "amount_received",
        "payment_completion_status",
        "outstanding_balance",
        "receipt_number",
        "receipt_generated_at",
        "platform_commission",
        "paystack_fee",
        "owner_net_amount",
        "settlement_status",
        "settlement_reference",
        "settlement_id",
        "settlement_account",
        "settlement_response",
        "settled_at",
        "created_at",
        "updated_at",
    )

    ordering = (
        "-created_at",
    )

    list_select_related = (
        "tenant",
        "landlord",
        "property",
        "booking",
    )

    fieldsets = (
        (
            "Payment information",
            {
                "fields": (
                    "reference",
                    "tenant",
                    "landlord",
                    "booking",
                    "renewal_request",
                    "property",
                    "room",
                    "payment_type",
                    "payment_method",
                    "duration_months",
                    "amount",
                    "status",
                )
            },
        ),
        (
            "Paystack information",
            {
                "fields": (
                    "paystack_access_code",
                    "paystack_authorization_url",
                    "paystack_response",
                    "verified_at",
                )
            },
        ),
        (
            "Receipt information",
            {
                "fields": (
                    "expected_amount",
                    "amount_received",
                    "payment_completion_status",
                    "outstanding_balance",
                    "receipt_number",
                    "receipt_generated_at",
                )
            },
        ),
        (
            "Settlement information",
            {
                "fields": (
                    "platform_commission",
                    "paystack_fee",
                    "owner_net_amount",
                    "settlement_status",
                    "settlement_reference",
                    "settlement_id",
                    "settlement_account",
                    "settlement_response",
                    "settled_at",
                )
            },
        ),
        (
            "Record dates",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )