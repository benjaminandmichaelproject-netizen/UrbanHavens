from django.db import transaction
from django.utils import timezone

from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.utils import send_notification

from .models import (
    LeaseRenewalRequest,
    TenantLease,
)
from .serializers import TenantLeaseSerializer


class CompleteLeaseRenewalView(APIView):
    # Requires an authenticated property owner or administrator.
    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def post(self, request, renewal_id):
        user = request.user
        role = getattr(user, "role", None)

        # Restricts renewal completion to owners and administrators.
        if not (
            user.is_superuser
            or role in [
                "owner",
                "landlord",
                "admin",
            ]
        ):
            raise PermissionDenied(
                "Only the property owner can complete "
                "a lease renewal."
            )

        with transaction.atomic():
            try:
                # Locks the renewal and related records against duplicates.
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
                    .get(
                        id=renewal_id,
                    )
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

            # Prevents one owner from completing another owner's renewal.
            if not (
                user.is_superuser
                or role == "admin"
                or renewal.landlord_id == user.id
            ):
                raise PermissionDenied(
                    "You cannot complete another owner's "
                    "lease renewal."
                )

            # Requires successful renewal payment first.
            if renewal.status != "payment_completed":
                return Response(
                    {
                        "detail": (
                            "Only a fully processed renewal payment "
                            "can be completed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                # Loads and locks the payment linked to the renewal.
                payment = (
                    renewal.renewal_payment.__class__.objects
                    .select_for_update()
                    .get(
                        pk=renewal.renewal_payment.pk,
                    )
                )
            except Exception:
                return Response(
                    {
                        "detail": (
                            "No renewal payment is linked to "
                            "this request."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Requires a successful payment record.
            if payment.status != "success":
                return Response(
                    {
                        "detail": (
                            "The renewal payment has not been "
                            "confirmed successfully."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Requires full payment before creating the renewed lease.
            if payment.payment_completion_status not in [
                "full",
                "overpaid",
            ]:
                return Response(
                    {
                        "detail": (
                            "The renewal cannot be completed while "
                            "an outstanding balance remains."
                        ),
                        "outstanding_balance": str(
                            payment.outstanding_balance
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Locks the lease currently being renewed.
            try:
                current_lease = (
                    TenantLease.objects
                    .select_for_update()
                    .select_related(
                        "property",
                        "tenant",
                        "landlord",
                        "room",
                    )
                    .get(
                        pk=renewal.current_lease_id,
                    )
                )
            except TenantLease.DoesNotExist:
                return Response(
                    {
                        "detail": (
                            "The current lease no longer exists."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Confirms the renewal still matches the original lease.
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
                            "The renewal request no longer matches "
                            "the current lease."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Prevents completing the renewal before its start date.
            today = timezone.localdate()

            if today < renewal.proposed_start_date:
                return Response(
                    {
                        "detail": (
                            "The renewed lease cannot become active "
                            "before its proposed start date."
                        ),
                        "renewal_start_date": (
                            renewal.proposed_start_date
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents duplicate completion of the same renewal.
            if renewal.status == "approved":
                return Response(
                    {
                        "detail": (
                            "This renewal has already been completed."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Prevents another active lease for the same tenant and property.
            duplicate_active_lease = (
                TenantLease.objects
                .select_for_update()
                .filter(
                    tenant=renewal.tenant,
                    property=renewal.property,
                    status="active",
                )
                .exclude(
                    id=current_lease.id,
                )
                .exists()
            )

            if duplicate_active_lease:
                return Response(
                    {
                        "detail": (
                            "Another active lease already exists "
                            "for this tenant and property."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Prevents another active house tenancy.
            if renewal.property.category == "house_rent":
                another_house_lease = (
                    TenantLease.objects
                    .select_for_update()
                    .filter(
                        property=renewal.property,
                        status="active",
                    )
                    .exclude(
                        id=current_lease.id,
                    )
                    .exists()
                )

                if another_house_lease:
                    return Response(
                        {
                            "detail": (
                                "Another active lease already exists "
                                "for this property."
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

            # Prevents another tenant from occupying the same renewed room.
            if renewal.property.category == "hostel":
                if not renewal.room_id:
                    return Response(
                        {
                            "detail": (
                                "A hostel renewal requires the "
                                "tenant's current room."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if (
                    renewal.room.property_id
                    != renewal.property_id
                ):
                    return Response(
                        {
                            "detail": (
                                "The renewal room does not belong "
                                "to the selected hostel."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Ends the historical lease without changing occupancy.
            current_lease.status = "ended"

            current_notes = current_lease.notes or ""

            current_lease.notes = (
                f"{current_notes}\n"
                f"[Renewed] Continued under renewal "
                f"request #{renewal.id}."
            ).strip()

            current_lease.save(
                update_fields=[
                    "status",
                    "notes",
                ]
            )

            # Creates a fresh lease and agreement for the renewed period.
            new_lease = TenantLease.objects.create(
                booking=None,
                property=renewal.property,
                tenant=renewal.tenant,
                landlord=renewal.landlord,
                room=renewal.room,
                lease_start_date=(
                    renewal.proposed_start_date
                ),
                lease_end_date=(
                    renewal.proposed_end_date
                ),
                move_in_date=(
                    renewal.proposed_start_date
                ),
                monthly_rent=renewal.monthly_rent,
                deposit_amount=0,
                first_payment_status="paid",
                notes=(
                    f"Renewal of lease "
                    f"#{current_lease.id}. "
                    f"Renewal request #{renewal.id}. "
                    f"Payment receipt: "
                    f"{payment.receipt_number or 'N/A'}."
                ),
                status="active",
            )

            # Marks the renewal workflow as completed.
            renewal.status = "approved"
            renewal.approved_at = timezone.now()

            renewal.save(
                update_fields=[
                    "status",
                    "approved_at",
                    "updated_at",
                ]
            )

            # Keeps the renewed house unavailable.
            if renewal.property.category == "house_rent":
                renewal.property.is_available = False
                renewal.property.save(
                    update_fields=[
                        "is_available",
                    ]
                )

            # Hostel occupancy remains unchanged during renewal.
            # The same tenant continues occupying the same room.

        try:
            # Notifies the tenant about the completed renewal.
            send_notification(
                user=renewal.tenant,
                message=(
                    f"Your lease for "
                    f"{renewal.property.property_name} "
                    f"has been renewed successfully. "
                    f"New period: "
                    f"{new_lease.lease_start_date} to "
                    f"{new_lease.lease_end_date}. "
                    f"Agreement number: "
                    f"{new_lease.agreement_number}."
                ),
                notification_type="lease_renewed",
                property_id=renewal.property_id,
            )
        except Exception as exc:
            # Prevents notification failure from reversing renewal.
            print(
                "LEASE RENEWAL COMPLETION "
                "NOTIFICATION FAILED:",
                repr(exc),
                flush=True,
            )

        return Response(
            {
                "detail": (
                    "Lease renewal completed successfully. "
                    "A new lease and tenancy agreement "
                    "have been generated."
                ),
                "renewal_id": renewal.id,
                "renewal_status": renewal.status,
                "previous_lease_id": current_lease.id,
                "new_lease": TenantLeaseSerializer(
                    new_lease,
                    context={
                        "request": request,
                    },
                ).data,
                "payment": {
                    "id": payment.id,
                    "reference": payment.reference,
                    "receipt_number": (
                        payment.receipt_number
                    ),
                    "amount_received": str(
                        payment.amount_received
                    ),
                    "payment_status": (
                        payment.payment_completion_status
                    ),
                },
            },
            status=status.HTTP_201_CREATED,
        )