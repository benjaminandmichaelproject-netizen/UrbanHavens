from django.db import transaction
from django.utils import timezone

from rest_framework import (
    permissions,
    status,
)
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import send_notification

from .models import LeaseRenewalRequest
from .renewal_serializers import (
    CreateLeaseRenewalRequestSerializer,
    LeaseRenewalRequestSerializer,
)


class CreateLeaseRenewalRequestView(APIView):
    # Requires an authenticated tenant.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request):
        # Validates and creates the renewal request.
        serializer = CreateLeaseRenewalRequestSerializer(
            data=request.data,
            context={
                "request": request,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        renewal = serializer.save()

        try:
            # Notifies the landlord about the request.
            tenant_name = (
                renewal.tenant.get_full_name().strip()
                or renewal.tenant.username
                or renewal.tenant.email
            )

            send_notification(
                user=renewal.landlord,
                message=(
                    f"{tenant_name} requested a "
                    f"{renewal.requested_duration_months}-month "
                    f"renewal for "
                    f"{renewal.property.property_name}."
                ),
                notification_type=(
                    "lease_renewal_requested"
                ),
                property_id=renewal.property_id,
            )
        except Exception as exc:
            print(
                "LEASE RENEWAL REQUEST "
                "NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Lease renewal request created "
                    "successfully."
                ),
                "renewal": LeaseRenewalRequestSerializer(
                    renewal
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class TenantRenewalListView(APIView):
    # Requires an authenticated tenant.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):
        # Returns only renewal requests belonging to the tenant.
        renewals = (
            LeaseRenewalRequest.objects
            .select_related(
                "current_lease",
                "tenant",
                "landlord",
                "property",
                "room",
            )
            .filter(
                tenant=request.user,
            )
            .order_by("-created_at")
        )

        return Response(
            LeaseRenewalRequestSerializer(
                renewals,
                many=True,
            ).data,
            status=status.HTTP_200_OK,
        )


class OwnerRenewalListView(APIView):
    # Requires an authenticated owner or administrator.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request):
        user = request.user
        role = getattr(user, "role", None)

        if not (
            user.is_superuser
            or role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only property owners can view "
                "renewal requests."
            )

        # Loads renewal records efficiently.
        renewals = (
            LeaseRenewalRequest.objects
            .select_related(
                "current_lease",
                "tenant",
                "landlord",
                "property",
                "room",
            )
            .order_by("-created_at")
        )

        # Restricts ordinary owners to their own records.
        if not (
            user.is_superuser
            or role == "admin"
        ):
            renewals = renewals.filter(
                landlord=user,
            )

        return Response(
            LeaseRenewalRequestSerializer(
                renewals,
                many=True,
            ).data,
            status=status.HTTP_200_OK,
        )


class ApproveRenewalRequestView(APIView):
    # Requires an authenticated owner or administrator.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, renewal_id):
        user = request.user
        role = getattr(user, "role", None)

        if not (
            user.is_superuser
            or role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only property owners can approve renewals."
            )

        with transaction.atomic():
            try:
                # Locks the request against duplicate decisions.
                renewal = (
                    LeaseRenewalRequest.objects
                    .select_for_update()
                    .select_related(
                        "current_lease",
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                    )
                    .get(id=renewal_id)
                )
            except LeaseRenewalRequest.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "Lease renewal request not found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not (
                user.is_superuser
                or role == "admin"
                or renewal.landlord_id == user.id
            ):
                raise PermissionDenied(
                    "You cannot approve another "
                    "owner's renewal request."
                )

            if renewal.status != "pending":
                return Response(
                    {
                        "detail": (
                            "Only pending renewal requests "
                            "can be approved."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            current_lease = renewal.current_lease

            # Confirms the request still matches the lease.
            relationships_match = (
                current_lease.tenant_id
                == renewal.tenant_id
                and current_lease.landlord_id
                == renewal.landlord_id
                and current_lease.property_id
                == renewal.property_id
                and current_lease.room_id
                == renewal.room_id
            )

            if not relationships_match:
                return Response(
                    {
                        "detail": (
                            "The renewal request no longer "
                            "matches the current lease."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if current_lease.status != "active":
                return Response(
                    {
                        "detail": (
                            "Only an active lease can proceed "
                            "to renewal payment."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Moves the request to the payment stage.
            renewal.status = "payment_pending"
            renewal.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

        try:
            # Notifies the tenant that payment is required.
            send_notification(
                user=renewal.tenant,
                message=(
                    f"Your renewal request for "
                    f"{renewal.property.property_name} "
                    f"was approved. Amount due: "
                    f"GHS {renewal.expected_amount}. "
                    f"Complete payment to continue."
                ),
                notification_type=(
                    "lease_renewal_approved"
                ),
                property_id=renewal.property_id,
            )
        except Exception as exc:
            print(
                "LEASE RENEWAL APPROVAL "
                "NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Renewal request approved. "
                    "The tenant can now complete payment."
                ),
                "renewal": LeaseRenewalRequestSerializer(
                    renewal
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class RejectRenewalRequestView(APIView):
    # Requires an authenticated owner or administrator.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, renewal_id):
        user = request.user
        role = getattr(user, "role", None)

        if not (
            user.is_superuser
            or role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only property owners can reject renewals."
            )

        rejection_note = str(
            request.data.get(
                "note",
                "",
            )
            or ""
        ).strip()

        if len(rejection_note) > 2000:
            return Response(
                {
                    "note": (
                        "Rejection note cannot exceed "
                        "2000 characters."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            try:
                # Locks the request against duplicate decisions.
                renewal = (
                    LeaseRenewalRequest.objects
                    .select_for_update()
                    .select_related(
                        "current_lease",
                        "tenant",
                        "landlord",
                        "property",
                        "room",
                    )
                    .get(id=renewal_id)
                )
            except LeaseRenewalRequest.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "Lease renewal request not found."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not (
                user.is_superuser
                or role == "admin"
                or renewal.landlord_id == user.id
            ):
                raise PermissionDenied(
                    "You cannot reject another "
                    "owner's renewal request."
                )

            if renewal.status != "pending":
                return Response(
                    {
                        "detail": (
                            "Only pending renewal requests "
                            "can be rejected."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if rejection_note:
                existing_notes = renewal.notes or ""

                renewal.notes = (
                    f"{existing_notes}\n"
                    f"[Owner rejection] "
                    f"{rejection_note}"
                ).strip()

            renewal.status = "rejected"
            renewal.rejected_at = timezone.now()

            renewal.save(
                update_fields=[
                    "status",
                    "notes",
                    "rejected_at",
                    "updated_at",
                ]
            )

        try:
            # Notifies the tenant about the rejection.
            message = (
                f"Your renewal request for "
                f"{renewal.property.property_name} "
                f"was rejected."
            )

            if rejection_note:
                message += (
                    f" Reason: {rejection_note}"
                )

            send_notification(
                user=renewal.tenant,
                message=message,
                notification_type=(
                    "lease_renewal_rejected"
                ),
                property_id=renewal.property_id,
            )
        except Exception as exc:
            print(
                "LEASE RENEWAL REJECTION "
                "NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Renewal request rejected "
                    "successfully."
                ),
                "renewal": LeaseRenewalRequestSerializer(
                    renewal
                ).data,
            },
            status=status.HTTP_200_OK,
        )