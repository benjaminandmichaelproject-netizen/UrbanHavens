from django.urls import path

from .receipt_views import PaymentReceiptView
from .renewal_views import (
    ConfirmDirectRenewalPaymentView,
    InitializeRenewalPaymentView,
    VerifyRenewalPaymentView,
)
from .settlement_views import SyncPaymentSettlementView
from .views import (
    ConfirmDirectPaymentView,
    InitializePaymentView,
    OwnerOnsitePaymentsView,
    OwnerPaymentAccountView,
    OwnerPaymentsView,
    OwnerTransactionsView,
    RejectDirectPaymentView,
    TenantTransactionsView,
    VerifyPaymentView,
)


urlpatterns = [
    # Returns or updates the owner's settlement account.
    path(
        "owner/payment-account/",
        OwnerPaymentAccountView.as_view(),
        name="owner-payment-account",
    ),

    # Returns Paystack payment and settlement records for the owner.
    path(
        "owner/payments/",
        OwnerPaymentsView.as_view(),
        name="owner-payments",
    ),

    # Returns all tenant payment transactions.
    path(
        "tenant/transactions/",
        TenantTransactionsView.as_view(),
        name="tenant-transactions",
    ),

    # Initializes a first-time booking payment.
    path(
        "initialize/",
        InitializePaymentView.as_view(),
        name="initialize-payment",
    ),

    # Verifies a first-time Paystack booking payment.
    path(
        "verify/<str:reference>/",
        VerifyPaymentView.as_view(),
        name="verify-payment",
    ),

    # Returns pending direct payments for the owner.
    path(
        "owner/onsite-payments/",
        OwnerOnsitePaymentsView.as_view(),
        name="owner-onsite-payments",
    ),

    # Confirms a first-time direct payment.
    path(
        "owner/onsite-payments/<int:payment_id>/confirm/",
        ConfirmDirectPaymentView.as_view(),
        name="confirm-direct-payment",
    ),

    # Rejects a first-time direct payment.
    path(
        "owner/onsite-payments/<int:payment_id>/reject/",
        RejectDirectPaymentView.as_view(),
        name="reject-direct-payment",
    ),

    # Returns the official receipt for an authorized participant.
    path(
        "<int:payment_id>/receipt/",
        PaymentReceiptView.as_view(),
        name="payment-receipt",
    ),

    # Synchronizes one Paystack settlement record.
    path(
        "owner/payments/<int:payment_id>/sync-settlement/",
        SyncPaymentSettlementView.as_view(),
        name="sync-payment-settlement",
    ),

    # Returns all direct and Paystack transactions for the owner.
    path(
        "owner/transactions/",
        OwnerTransactionsView.as_view(),
        name="owner-transactions",
    ),

    # Initializes Paystack or direct renewal payment.
    path(
        "renewals/initialize/",
        InitializeRenewalPaymentView.as_view(),
        name="initialize-renewal-payment",
    ),

    # Verifies a Paystack renewal payment.
    path(
        "renewals/verify/<str:reference>/",
        VerifyRenewalPaymentView.as_view(),
        name="verify-renewal-payment",
    ),

    # Allows the owner to confirm a direct renewal payment.
    path(
        "renewals/direct/<int:payment_id>/confirm/",
        ConfirmDirectRenewalPaymentView.as_view(),
        name="confirm-direct-renewal-payment",
    ),
]