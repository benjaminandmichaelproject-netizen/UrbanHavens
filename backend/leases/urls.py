from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .agreement_views import TenancyAgreementView
from .payment_views import (
    AwaitingLeaseListView,
    CreateLeaseFromPaymentView,
)
from .renewal_completion_views import (
    CompleteLeaseRenewalView,
)
from .renewal_views import (
    ApproveRenewalRequestView,
    CreateLeaseRenewalRequestView,
    OwnerRenewalListView,
    RejectRenewalRequestView,
    TenantRenewalListView,
)
from .views import TenantLeaseViewSet


# Registers the existing lease management endpoints.
router = DefaultRouter()
router.register(
    r"leases",
    TenantLeaseViewSet,
    basename="lease",
)


# Combines lease, payment, agreement, and renewal endpoints.
urlpatterns = [
    # Returns payments waiting for first-time lease creation.
    path(
        "leases/awaiting/",
        AwaitingLeaseListView.as_view(),
        name="awaiting-leases",
    ),

    # Creates a first-time lease from a successful payment.
    path(
        "leases/create-from-payment/<int:payment_id>/",
        CreateLeaseFromPaymentView.as_view(),
        name="create-lease-from-payment",
    ),

    # Returns the protected official tenancy agreement.
    path(
        "leases/<int:lease_id>/agreement/",
        TenancyAgreementView.as_view(),
        name="tenancy-agreement",
    ),

    # Allows a tenant to submit a lease-renewal request.
    path(
        "leases/renewals/request/",
        CreateLeaseRenewalRequestView.as_view(),
        name="create-lease-renewal-request",
    ),

    # Returns renewal requests belonging to the owner.
    path(
        "leases/renewals/owner/",
        OwnerRenewalListView.as_view(),
        name="owner-renewal-list",
    ),

    # Approves a pending renewal and moves it to payment.
    path(
        "leases/renewals/<int:renewal_id>/approve/",
        ApproveRenewalRequestView.as_view(),
        name="approve-lease-renewal",
    ),

    # Rejects a pending renewal request.
    path(
        "leases/renewals/<int:renewal_id>/reject/",
        RejectRenewalRequestView.as_view(),
        name="reject-lease-renewal",
    ),

    # Creates the renewed lease after full payment.
    path(
        "leases/renewals/<int:renewal_id>/complete/",
        CompleteLeaseRenewalView.as_view(),
        name="complete-lease-renewal",
    ),
    # Returns renewal requests belonging to the authenticated tenant.
path(
    "leases/renewals/tenant/",
    TenantRenewalListView.as_view(),
    name="tenant-renewal-list",
),

    # Preserves all existing TenantLease viewset endpoints.
    path(
        "",
        include(router.urls),
    ),
]